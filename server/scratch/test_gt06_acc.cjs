// Let's decode the status packet 0x16:
// Example: 78 78 25 16 1a 0b 11 05 00 09 cc 01 1d 02 47 08 19 6b 41 14 9c 18 08 02 dc 67 05 7e c3 d2 e8 46 06 04 2c 02 10 9c 64 f2 0d 0a
// Length: 0x25 = 37 bytes
// Protocol: 0x16
// Date/time: 1a(26) 0b(11) 11(17) 05(05) 00(00) 09(09) -> 2026-11-17 05:00:09 UTC -> 00:00:09 Colombia!
// GPS info length & quantity: cc
// Lat (4 bytes): 01 1d 02 47 -> 18678343 / 1800000 = 10.376857 deg
// Lon (4 bytes): 08 19 6b 41 -> 135883585 / 1800000 = 75.49088 deg
// Speed (1 byte): 14 -> 20 km/h (or knots? 10.8 knots * 1.852 = 20 km/h!)
// Course & Status (2 bytes): 9c 18
// LBS info: 08 02 dc 67 05 7e c3 d2 e8
// Terminal Information (Status): 46
// In GT06 terminal information byte:
// Bit 7: Oil and electricity connected (1: yes, 0: cut off)
// Bit 6: GPS tracking on/off
// Bit 5-3: Alarm code
// Bit 2: Charge on/off
// Bit 1: ACC (Ignition) 1: High (ON), 0: Low (OFF)
// Bit 0: Defense active (Arm/Disarm)

// Let's inspect the terminal information byte in 0x13 and 0x16:
// In 0x13: 78 78 0a 13 [46] 06 04 00 01 0a 71 eb fc 0d 0a
// Here terminal info is 0x46:
// 0x46 in binary: 0100 0110
// Bit 1 is 1 -> ACC = ON!
// In 0x05: 0000 0101 -> Bit 1 is 0 -> ACC = OFF!
// In 0x85: 1000 0101 -> Bit 1 is 0 -> ACC = OFF!
// In 0x45: 0100 0101 -> Bit 1 is 0 -> ACC = OFF!
// In 0x04: 0000 0100 -> Bit 1 is 0 -> ACC = OFF!
console.log('0x46 ACC bit:', (0x46 & 0x02) !== 0); // true (ON)
console.log('0x05 ACC bit:', (0x05 & 0x02) !== 0); // false (OFF)
console.log('0x45 ACC bit:', (0x45 & 0x02) !== 0); // false (OFF)
console.log('0x85 ACC bit:', (0x85 & 0x02) !== 0); // false (OFF)

