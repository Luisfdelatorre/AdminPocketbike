import settingRepository from '../repositories/settingRepository.js';
import logger from '../utils/logger.js';

class SettingController {
    async getAdjustmentTypes(req, res) {
        try {
            const types = await settingRepository.getAdjustmentTypes();
            return res.json({ success: true, data: types });
        } catch (error) {
            logger.error('Error fetching adjustment types:', error);
            return res.status(500).json({ success: false, error: 'Error al obtener tipos de ajuste' });
        }
    }

    async updateAdjustmentTypes(req, res) {
        try {
            const typesData = req.body;
            if (!typesData || typeof typesData !== 'object') {
                return res.status(400).json({ success: false, error: 'Datos inválidos para tipos de ajuste' });
            }

            const updated = await settingRepository.updateAdjustmentTypes(typesData);
            return res.json({ success: true, data: updated, message: 'Tipos de ajuste actualizados exitosamente' });
        } catch (error) {
            logger.error('Error updating adjustment types:', error);
            return res.status(500).json({ success: false, error: 'Error al actualizar tipos de ajuste' });
        }
    }
}

export default new SettingController();
