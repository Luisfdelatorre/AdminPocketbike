# API del dashboard

Estado: referencia especializada activa. Revisada el 2026-07-20.

## Endpoint vigente

```http
GET /apinode/dashboard/stats
Authorization: Bearer <token>
```

Parámetros opcionales:

- `year`: año del periodo; por defecto, el año actual.
- `month`: mes numérico. Si se omite, el alcance agregado es anual.

No existe actualmente una ruta montada `/dashboard/revenue/:period`; las gráficas se incluyen en la respuesta de `stats`.

## Respuesta

```json
{
  "success": true,
  "data": {
    "stats": {
      "totalRevenue": 0,
      "activeDevices": 0,
      "pendingPayments": 0,
      "totalInvoiced": 0,
      "totalPaidInvoices": 0,
      "collectionGap": 0,
      "collectionRate": 100,
      "changes": {}
    },
    "recentPayments": [],
    "revenueData": [],
    "deviceData": []
  }
}
```

La forma exacta debe verificarse en `server/services/dashboardService.js` antes de cambiar consumidores.

## Flujo de datos

El router aplica `authenticate`. El controlador toma `companyId` del token y normaliza el periodo. El servicio coordina repositorios de contratos, dispositivos, pagos y facturas, usando consultas paralelas cuando son independientes.

Los datos incluyen:

- ingresos aprobados del periodo;
- total facturado, facturas pagadas y brecha de recaudo;
- dispositivos con contrato activo;
- facturas pendientes;
- pagos recientes;
- ingresos de los últimos seis meses;
- distribución de estado derivada de contratos.

## Consideraciones

- El dashboard debe respetar el alcance de compañía del JWT.
- Los importes no tienen una única unidad heredada en todos los flujos; verifica repositorios antes de convertir centavos.
- La serie de `expenses` es estimada en el servicio y no representa un modelo contable persistido.
- La zona horaria puede afectar periodos y agrupaciones.
- Un cambio de respuesta es un cambio de contrato de API y requiere revisar el orden de carga y todos los consumidores.

Prueba local:

```bash
curl 'http://localhost:8084/apinode/dashboard/stats?year=2026&month=7' \
  -H 'Authorization: Bearer TOKEN'
```
