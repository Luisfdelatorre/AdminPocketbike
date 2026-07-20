# Historial paginado de pagos

Estado: referencia especializada activa. Revisada el 2026-07-20.

## Objetivo

El historial administrativo evita recorrer contratos y consultar cada dispositivo por separado. El flujo vigente accede directamente a `Payment` mediante repositorio y limita la respuesta al día seleccionado.

```text
GET /apinode/payments/all
  → paymentController.getPaymentHistory
  → paymentService.getPaymentHistory
  → paymentRepository.getAllPaymentsPaginated
```

La ruta requiere `authenticate`.

## Parámetros

- `page`: posición del día dentro de los días con movimientos, ordenados del más reciente al más antiguo.
- `limit`: aceptado por la capa superior, pero el repositorio vigente devuelve todos los pagos del día seleccionado.
- `status`: filtro opcional.

El alcance de compañía se obtiene del JWT, excepto para el administrador de sistema. No debe enviarse un `companyId` arbitrario desde el cliente para ampliar el acceso.

## Respuesta

```json
{
  "success": true,
  "payments": [],
  "pagination": {
    "page": 1,
    "limit": 0,
    "total": 0,
    "totalPages": 0,
    "hasNext": false,
    "hasPrev": false
  }
}
```

`totalPages` representa días con movimientos, no páginas de tamaño fijo. `limit` refleja el número de pagos encontrados en el día. Esta semántica debe conservarse o versionarse si cambia el contrato.

## Rendimiento

El repositorio:

1. filtra por compañía y estado;
2. agrupa fechas con una agregación MongoDB;
3. cuenta movimientos en paralelo;
4. selecciona un día;
5. consulta únicamente los pagos de ese intervalo y los ordena por `createdAt` descendente.

Esto elimina el patrón N+1 por dispositivo, pero no garantiza tiempo constante: el costo depende de índices, cardinalidad, agrupación y cantidad de pagos del día. No deben publicarse cifras de rendimiento sin mediciones reproducibles.

## Índices y validación

`Payment` tiene índices para estado, fechas e identificadores. Antes de ajustar filtros o paginación:

- revisa el plan de consulta con datos representativos;
- verifica límites de compañía y zona horaria;
- prueba días vacíos y días con alta carga;
- confirma que la UI interpreta `totalPages` como días;
- evita cargar todo el histórico en memoria.

Ejemplo:

```bash
curl 'http://localhost:8084/apinode/payments/all?page=1&status=APPROVED' \
  -H 'Authorization: Bearer TOKEN'
```
