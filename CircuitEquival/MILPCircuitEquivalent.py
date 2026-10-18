import json
import re
from pathlib import Path
from docplex.mp.model import Model


# ============================================================
# Utility functions
# ============================================================

def clean_name(name):
    """
    Convert Yosys names into safe DOCplex names.
    """
    return re.sub(r"[^a-zA-Z0-9_]", "_", str(name))


def bit_key(bit):
    """
    Use string keys for Yosys bit IDs.
    """
    return str(bit)


def is_const_zero(bit):
    return isinstance(bit, str) and bit == "0"


def is_const_one(bit):
    return isinstance(bit, str) and bit == "1"


def is_const_expr(v):
    return isinstance(v, int) and v in (0, 1)


def is_val(v, val):
    return isinstance(v, int) and v == val


# ============================================================
# Gate encodings
# ============================================================

def add_and(mdl, y, a, b, name):
    # y = a AND b
    if is_const_expr(a) and is_const_expr(b):
        mdl.add_constraint(y == int(a and b), ctname=f"{name}_and_const")
        return

    if is_val(a, 0) or is_val(b, 0):
        mdl.add_constraint(y == 0, ctname=f"{name}_and_zero")
        return

    if is_val(a, 1):
        mdl.add_constraint(y == b, ctname=f"{name}_and_a_one")
        return

    if is_val(b, 1):
        mdl.add_constraint(y == a, ctname=f"{name}_and_b_one")
        return

    mdl.add_constraint(y <= a, ctname=f"{name}_and_1")
    mdl.add_constraint(y <= b, ctname=f"{name}_and_2")
    mdl.add_constraint(y >= a + b - 1, ctname=f"{name}_and_3")


def add_or(mdl, y, a, b, name):
    # y = a OR b
    if is_const_expr(a) and is_const_expr(b):
        mdl.add_constraint(y == int(a or b), ctname=f"{name}_or_const")
        return

    if is_val(a, 1) or is_val(b, 1):
        mdl.add_constraint(y == 1, ctname=f"{name}_or_one")
        return

    if is_val(a, 0):
        mdl.add_constraint(y == b, ctname=f"{name}_or_a_zero")
        return

    if is_val(b, 0):
        mdl.add_constraint(y == a, ctname=f"{name}_or_b_zero")
        return

    mdl.add_constraint(y >= a, ctname=f"{name}_or_1")
    mdl.add_constraint(y >= b, ctname=f"{name}_or_2")
    mdl.add_constraint(y <= a + b, ctname=f"{name}_or_3")


def add_not(mdl, y, a, name):
    # y = NOT a
    if is_const_expr(a):
        mdl.add_constraint(y == 1 - a, ctname=f"{name}_not_const")
        return

    mdl.add_constraint(y == 1 - a, ctname=f"{name}_not")


def add_nand(mdl, y, a, b, name):
    # y = NOT(a AND b)
    if is_const_expr(a) and is_const_expr(b):
        mdl.add_constraint(y == int(not (a and b)), ctname=f"{name}_nand_const")
        return

    if is_val(a, 0) or is_val(b, 0):
        mdl.add_constraint(y == 1, ctname=f"{name}_nand_zero")
        return

    if is_val(a, 1):
        add_not(mdl, y, b, f"{name}_nand_a_one")
        return

    if is_val(b, 1):
        add_not(mdl, y, a, f"{name}_nand_b_one")
        return

    mdl.add_constraint(y >= 1 - a, ctname=f"{name}_nand_1")
    mdl.add_constraint(y >= 1 - b, ctname=f"{name}_nand_2")
    mdl.add_constraint(y <= 2 - a - b, ctname=f"{name}_nand_3")


def add_nor(mdl, y, a, b, name):
    # y = NOT(a OR b)
    if is_const_expr(a) and is_const_expr(b):
        mdl.add_constraint(y == int(not (a or b)), ctname=f"{name}_nor_const")
        return

    if is_val(a, 1) or is_val(b, 1):
        mdl.add_constraint(y == 0, ctname=f"{name}_nor_one")
        return

    if is_val(a, 0):
        add_not(mdl, y, b, f"{name}_nor_a_zero")
        return

    if is_val(b, 0):
        add_not(mdl, y, a, f"{name}_nor_b_zero")
        return

    mdl.add_constraint(y <= 1 - a, ctname=f"{name}_nor_1")
    mdl.add_constraint(y <= 1 - b, ctname=f"{name}_nor_2")
    mdl.add_constraint(y >= 1 - a - b, ctname=f"{name}_nor_3")


def add_xor(mdl, y, a, b, name):
    # y = a XOR b
    if is_const_expr(a) and is_const_expr(b):
        mdl.add_constraint(y == int(a != b), ctname=f"{name}_xor_const")
        return

    if is_val(a, 0):
        mdl.add_constraint(y == b, ctname=f"{name}_xor_a_zero")
        return

    if is_val(b, 0):
        mdl.add_constraint(y == a, ctname=f"{name}_xor_b_zero")
        return

    if is_val(a, 1):
        add_not(mdl, y, b, f"{name}_xor_a_one")
        return

    if is_val(b, 1):
        add_not(mdl, y, a, f"{name}_xor_b_one")
        return

    mdl.add_constraint(y <= a + b, ctname=f"{name}_xor_1")
    mdl.add_constraint(y >= a - b, ctname=f"{name}_xor_2")
    mdl.add_constraint(y >= b - a, ctname=f"{name}_xor_3")
    mdl.add_constraint(y <= 2 - a - b, ctname=f"{name}_xor_4")


def add_xnor(mdl, y, a, b, name):
    # y = NOT(a XOR b)
    if is_const_expr(a) and is_const_expr(b):
        mdl.add_constraint(y == int(a == b), ctname=f"{name}_xnor_const")
        return

    if is_val(a, 0):
        add_not(mdl, y, b, f"{name}_xnor_a_zero")
        return

    if is_val(b, 0):
        add_not(mdl, y, a, f"{name}_xnor_b_zero")
        return

    if is_val(a, 1):
        mdl.add_constraint(y == b, ctname=f"{name}_xnor_a_one")
        return

    if is_val(b, 1):
        mdl.add_constraint(y == a, ctname=f"{name}_xnor_b_one")
        return

    mdl.add_constraint(y >= 1 - a - b, ctname=f"{name}_xnor_1")
    mdl.add_constraint(y >= a + b - 1, ctname=f"{name}_xnor_2")
    mdl.add_constraint(y <= 1 - a + b, ctname=f"{name}_xnor_3")
    mdl.add_constraint(y <= 1 - b + a, ctname=f"{name}_xnor_4")


def add_andnot(mdl, y, a, b, name):
    # Yosys $_ANDNOT_: y = a AND (NOT b)
    if is_const_expr(a) and is_const_expr(b):
        mdl.add_constraint(y == int(a and not b), ctname=f"{name}_andnot_const")
        return

    if is_val(a, 0) or is_val(b, 1):
        mdl.add_constraint(y == 0, ctname=f"{name}_andnot_zero")
        return

    if is_val(a, 1):
        add_not(mdl, y, b, f"{name}_andnot_a_one")
        return

    if is_val(b, 0):
        mdl.add_constraint(y == a, ctname=f"{name}_andnot_b_zero")
        return

    mdl.add_constraint(y <= a, ctname=f"{name}_andnot_1")
    mdl.add_constraint(y <= 1 - b, ctname=f"{name}_andnot_2")
    mdl.add_constraint(y >= a - b, ctname=f"{name}_andnot_3")


def add_ornot(mdl, y, a, b, name):
    # Yosys $_ORNOT_: y = a OR (NOT b)
    if is_const_expr(a) and is_const_expr(b):
        mdl.add_constraint(y == int(a or not b), ctname=f"{name}_ornot_const")
        return

    if is_val(a, 1) or is_val(b, 0):
        mdl.add_constraint(y == 1, ctname=f"{name}_ornot_one")
        return

    if is_val(a, 0):
        add_not(mdl, y, b, f"{name}_ornot_a_zero")
        return

    if is_val(b, 1):
        mdl.add_constraint(y == a, ctname=f"{name}_ornot_b_one")
        return

    mdl.add_constraint(y >= a, ctname=f"{name}_ornot_1")
    mdl.add_constraint(y >= 1 - b, ctname=f"{name}_ornot_2")
    mdl.add_constraint(y <= a + 1 - b, ctname=f"{name}_ornot_3")


# ============================================================
# JSON helpers
# ============================================================

def get_constant_or_var(mdl, bit, bit_vars, prefix):
    """
    Yosys bits can be integers or strings "0"/"1".
    Return either constant 0/1 or a DOCplex binary variable.
    """
    if is_const_zero(bit):
        return 0

    if is_const_one(bit):
        return 1

    k = bit_key(bit)

    if k not in bit_vars:
        bit_vars[k] = mdl.binary_var(name=f"{prefix}_w{k}")

    return bit_vars[k]


def collect_port_bits(module, direction):
    """
    Collect one-bit ports only.
    Your Yosys JSON has ports like a[0], a[1], ..., f[0].
    """
    result = {}

    for pname, pinfo in module["ports"].items():
        if pinfo["direction"] == direction:
            if len(pinfo["bits"]) != 1:
                raise ValueError(f"Port {pname} is not one bit: {pinfo['bits']}")

            result[pname] = pinfo["bits"][0]

    return result


def build_driver_map(module):
    """
    Map each driven wire bit to the cell that drives it.
    """
    driver = {}

    for cname, cell in module["cells"].items():
        ybits = cell["connections"].get("Y", [])

        if len(ybits) == 1:
            y = ybits[0]
            driver[bit_key(y)] = cname

    return driver


def cone_of_influence(module, output_bits):
    """
    Return only the cells needed to compute selected output bits.
    This is essential for keeping the MILP small.
    """
    driver = build_driver_map(module)
    needed_cells = set()
    visited_bits = set()

    def visit_bit(bit):
        k = bit_key(bit)

        if k in visited_bits:
            return

        visited_bits.add(k)

        if k not in driver:
            return

        cname = driver[k]

        if cname in needed_cells:
            return

        needed_cells.add(cname)

        cell = module["cells"][cname]

        for port in ["A", "B"]:
            if port in cell["connections"]:
                for ibit in cell["connections"][port]:
                    visit_bit(ibit)

    for obit in output_bits:
        visit_bit(obit)

    ordered = []

    for cname in module["cells"]:
        if cname in needed_cells:
            ordered.append(cname)

    return ordered


def add_cell_constraints(mdl, cell, bit_vars, prefix, cname):
    """
    Add constraints for one Yosys cell.
    """
    ctype = cell["type"]
    con = cell["connections"]

    y = get_constant_or_var(mdl, con["Y"][0], bit_vars, prefix)

    a = None
    b = None

    if "A" in con:
        a = get_constant_or_var(mdl, con["A"][0], bit_vars, prefix)

    if "B" in con:
        b = get_constant_or_var(mdl, con["B"][0], bit_vars, prefix)

    safe = f"{prefix}_{clean_name(cname)}"

    if ctype == "$_AND_":
        add_and(mdl, y, a, b, safe)

    elif ctype == "$_OR_":
        add_or(mdl, y, a, b, safe)

    elif ctype == "$_NOT_":
        add_not(mdl, y, a, safe)

    elif ctype == "$_NAND_":
        add_nand(mdl, y, a, b, safe)

    elif ctype == "$_NOR_":
        add_nor(mdl, y, a, b, safe)

    elif ctype == "$_XOR_":
        add_xor(mdl, y, a, b, safe)

    elif ctype == "$_XNOR_":
        add_xnor(mdl, y, a, b, safe)

    elif ctype == "$_ANDNOT_":
        add_andnot(mdl, y, a, b, safe)

    elif ctype == "$_ORNOT_":
        add_ornot(mdl, y, a, b, safe)

    else:
        raise NotImplementedError(f"Unsupported cell type: {ctype}")


def load_yosys_json(path):
    """
    Load Yosys JSON and return module 'top'.
    """
    with open(path, "r") as f:
        data = json.load(f)

    return data["modules"]["top"]


# ============================================================
# Build one circuit
# ============================================================

def build_circuit_from_json(
    mdl,
    path,
    prefix,
    shared_inputs,
    selected_output_names
):
    """
    Build MILP constraints for one Yosys JSON circuit.

    shared_inputs:
        maps input port name, e.g. a[0], to a shared MILP variable.
        Both circuits reuse the same input variables.

    selected_output_names:
        output names to compare, e.g. ["f[0]", "f[1]"].
    """
    module = load_yosys_json(path)

    input_ports = collect_port_bits(module, "input")
    output_ports = collect_port_bits(module, "output")

    for name in selected_output_names:
        if name not in output_ports:
            raise ValueError(f"Output {name} not found in {path}")

    input_bit_to_port = {
        bit_key(bit): pname
        for pname, bit in input_ports.items()
    }

    bit_vars = {}

    output_bits = [output_ports[name] for name in selected_output_names]
    needed_cells = cone_of_influence(module, output_bits)

    needed_input_bits = set()

    def mark_input_if_needed(bit):
        k = bit_key(bit)
        if k in input_bit_to_port:
            needed_input_bits.add(k)

    for cname in needed_cells:
        cell = module["cells"][cname]
        con = cell["connections"]

        for port in ["A", "B"]:
            if port in con:
                for bit in con[port]:
                    mark_input_if_needed(bit)

    # Rare case: selected output directly connected to input.
    for bit in output_bits:
        mark_input_if_needed(bit)

    def sort_key(x):
        if str(x).isdigit():
            return int(x)
        return str(x)

    for k in sorted(needed_input_bits, key=sort_key):
        pname = input_bit_to_port[k]

        if pname not in shared_inputs:
            shared_inputs[pname] = mdl.binary_var(name=clean_name(pname))

        bit_vars[k] = shared_inputs[pname]

    print(
        f"{prefix}: encoding {len(needed_cells)} cells, "
        f"{len(needed_input_bits)} input vars, "
        f"{len(selected_output_names)} outputs"
    )

    for cname in needed_cells:
        cell = module["cells"][cname]
        add_cell_constraints(mdl, cell, bit_vars, prefix, cname)

    outputs = {}

    for name in selected_output_names:
        bit = output_ports[name]
        outputs[name] = get_constant_or_var(mdl, bit, bit_vars, prefix)

    return outputs


# ============================================================
# Compact miter for several outputs
# ============================================================

def add_compact_miter(mdl, out1, out2, selected_outputs):
    """
    Compact miter.

    For each output k, create selector s_k.

    If s_k = 1, force:
        out1[k] + out2[k] = 1

    That means the two binary outputs are different.

    Then force:
        sum(s_k) >= 1

    If feasible:
        circuits are NOT equivalent.

    If infeasible:
        circuits are equivalent for selected outputs.
    """
    selectors = []

    for name in selected_outputs:
        a = out1[name]
        b = out2[name]

        s = mdl.binary_var(name=f"sel_diff_{clean_name(name)}")
        selectors.append(s)

        safe = clean_name(name)

        mdl.add_constraint(a + b >= s, ctname=f"compact_diff_lb_{safe}")
        mdl.add_constraint(a + b <= 2 - s, ctname=f"compact_diff_ub_{safe}")

    mdl.add_constraint(
        mdl.sum(selectors) >= 1,
        ctname="at_least_one_output_difference"
    )

    return selectors


# ============================================================
# Check multiple outputs together
# ============================================================

def check_equivalence_from_json(
    path1,
    path2,
    n_bits=4,
    include_cout=False,
    log_output=True,
    threads=None,
    time_limit=None
):
    """
    Check equivalence of f[0] ... f[n_bits-1], optionally cOut.
    Uses compact miter.
    """
    mdl = Model(name="circuit_equivalence_compact_miter")

    if threads is not None:
        mdl.parameters.threads = threads

    if time_limit is not None:
        mdl.parameters.timelimit = time_limit

    shared_inputs = {}

    selected_outputs = [f"f[{i}]" for i in range(n_bits)]

    if include_cout:
        selected_outputs.append("cOut")

    print("\nSelected outputs:")
    print(selected_outputs)

    out1 = build_circuit_from_json(
        mdl=mdl,
        path=path1,
        prefix="orig",
        shared_inputs=shared_inputs,
        selected_output_names=selected_outputs
    )

    out2 = build_circuit_from_json(
        mdl=mdl,
        path=path2,
        prefix="aig",
        shared_inputs=shared_inputs,
        selected_output_names=selected_outputs
    )

    selectors = add_compact_miter(
        mdl=mdl,
        out1=out1,
        out2=out2,
        selected_outputs=selected_outputs
    )

    mdl.minimize(0)

    print("\nMILP model statistics:")
    print(f"Variables: {mdl.number_of_variables}")
    print(f"Constraints: {mdl.number_of_constraints}")

    solution = mdl.solve(log_output=log_output)

    print("\nSolve details:")
    print(mdl.solve_details)

    if solution is None:
        print("\nRESULT: Equivalent for selected outputs.")
        print("No counterexample was found.")
        return None

    print("\nRESULT: NOT equivalent for selected outputs.")
    print("Counterexample found.")

    print("\nInput assignment:")
    for name in sorted(shared_inputs.keys()):
        var = shared_inputs[name]
        val = int(round(solution.get_value(var)))
        print(f"  {name} = {val}")

    print("\nOutput values:")
    for i, name in enumerate(selected_outputs):
        v1 = int(round(solution.get_value(out1[name])))
        v2 = int(round(solution.get_value(out2[name])))
        s = int(round(solution.get_value(selectors[i])))

        print(f"  {name}: original={v1}, aig={v2}, selected_diff={s}")

    return solution


# ============================================================
# Check one output only
# ============================================================

def check_one_output_from_json(
    path1,
    path2,
    output_name,
    log_output=True,
    threads=None,
    time_limit=None
):
    """
    Recommended mode for Community Edition.

    For one output, no selector or XOR is needed.
    To force difference:

        out1 + out2 == 1

    Since outputs are binary, this means out1 != out2.
    """
    mdl = Model(name=f"check_{clean_name(output_name)}")

    if threads is not None:
        mdl.parameters.threads = threads

    if time_limit is not None:
        mdl.parameters.timelimit = time_limit

    shared_inputs = {}
    selected_outputs = [output_name]

    print("\nChecking output:")
    print(selected_outputs)

    out1 = build_circuit_from_json(
        mdl=mdl,
        path=path1,
        prefix="orig",
        shared_inputs=shared_inputs,
        selected_output_names=selected_outputs
    )

    out2 = build_circuit_from_json(
        mdl=mdl,
        path=path2,
        prefix="aig",
        shared_inputs=shared_inputs,
        selected_output_names=selected_outputs
    )

    a = out1[output_name]
    b = out2[output_name]

    mdl.add_constraint(
        a + b == 1,
        ctname=f"force_difference_{clean_name(output_name)}"
    )

    mdl.minimize(0)

    print("\nMILP model statistics:")
    print(f"Variables: {mdl.number_of_variables}")
    print(f"Constraints: {mdl.number_of_constraints}")

    solution = mdl.solve(log_output=log_output)

    print("\nSolve details:")
    print(mdl.solve_details)

    if solution is None:
        print(f"\nRESULT: {output_name} is equivalent.")
        return None

    print(f"\nRESULT: {output_name} is NOT equivalent.")
    print("Counterexample found.")

    print("\nInput assignment:")
    for name in sorted(shared_inputs.keys()):
        var = shared_inputs[name]
        val = int(round(solution.get_value(var)))
        print(f"  {name} = {val}")

    v1 = int(round(solution.get_value(a)))
    v2 = int(round(solution.get_value(b)))

    print("\nOutput values:")
    print(f"  {output_name}: original={v1}, aig={v2}")

    return solution


# ============================================================
# Batch check one output at a time
# ============================================================

def check_outputs_one_by_one(
    path1,
    path2,
    n_bits=4,
    include_cout=False,
    log_output=False,
    threads=None,
    time_limit=None
):
    """
    Check f[0], f[1], ..., f[n_bits-1] one by one.

    This is the best option if you are hitting CPLEX Community
    Edition size limits.
    """
    outputs = [f"f[{i}]" for i in range(n_bits)]

    if include_cout:
        outputs.append("cOut")

    for output_name in outputs:
        sol = check_one_output_from_json(
            path1=path1,
            path2=path2,
            output_name=output_name,
            log_output=log_output,
            threads=threads,
            time_limit=time_limit
        )

        if sol is not None:
            print(f"\nSTOP: counterexample found at {output_name}")
            return sol

    print("\nFINAL RESULT: All checked outputs are equivalent.")
    return None


# ============================================================
# Main
# ============================================================

if __name__ == "__main__":

    BASE_DIR = Path(__file__).resolve().parent

    path_original = BASE_DIR / "adder_netlist.json"
    path_abc_aig = BASE_DIR / "adder_abc_aig_netlist.json"

    print("Original path:", path_original)
    print("ABC AIG path:", path_abc_aig)

    if not path_original.exists():
        raise FileNotFoundError(f"File not found: {path_original}")

    if not path_abc_aig.exists():
        raise FileNotFoundError(f"File not found: {path_abc_aig}")

    # ========================================================
    # Recommended first run:
    # Check one output at a time.
    # This keeps each MILP much smaller.
    # ========================================================

    import time
    start_time = time.perf_counter()
    check_outputs_one_by_one(
        path1=path_original,
        path2=path_abc_aig,
        n_bits=128,
        include_cout=False,
        log_output=True,
        threads=8,
        time_limit=300
    )
    end_time = time.perf_counter()
    print(f"check_outputs_one_by_one took {end_time - start_time:.4f} seconds.")

    # ========================================================
    # Optional:
    # Check several outputs together with compact miter.
    # This may exceed Community Edition limits.
    # Uncomment only if your Academic CPLEX license is working.
    # ========================================================

    # check_equivalence_from_json(
    #     path1=path_original,
    #     path2=path_abc_aig,
    #     n_bits=32,
    #     include_cout=False,
    #     log_output=True,
    #     threads=20
    #     #time_limit=300
    # )