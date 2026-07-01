import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { get } from '../services/api'; // assuming generic get helper
import { useTranslation } from 'react-i18next';

const UnpaidInvoices = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUnpaid = async () => {
      try {
        const res = await get('/invoices/unpaid'); // endpoint defined in server
        if (res.success) {
          setInvoices(res.data);
        } else {
          console.error('Failed fetching unpaid invoices', res.error);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchUnpaid();
  }, []);

  if (loading) {
    return <div>{t('loading')}...</div>;
  }

  return (
    <div className="unpaid-invoices-container">
      <h2>{t('unpaidInvoices.title', 'Facturas No Pagadas')}</h2>
      {invoices.length === 0 ? (
        <p>{t('unpaidInvoices.empty', 'No hay facturas pendientes de pago.')}</p>
      ) : (
        <table className="payments-table">
          <thead>
            <tr>
              <th>{t('unpaidInvoices.table.device', 'Dispositivo')}</th>
              <th>{t('unpaidInvoices.table.amount', 'Monto (COP)')}</th>
              <th>{t('unpaidInvoices.table.date', 'Fecha')}</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv._id}>
                <td>{inv.deviceIdName}</td>
                <td>{inv.amount?.toLocaleString()}</td>
                <td>{new Date(inv.date).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default UnpaidInvoices;
