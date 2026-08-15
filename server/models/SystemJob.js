import mongoose from 'mongoose';

const systemJobSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true
    },
    time: { 
        type: String, 
        required: true 
    }, // Cron expression "0 9 * * *" or "HH:mm"
    log: { 
        type: String,
        trim: true 
    },
    flag: { 
        type: Boolean, 
        default: false 
    }, // Activar/Desactivar
    job: { 
        type: String, 
        required: true,
        trim: true
    } // Nombre de la función en cronJobsServices
}, { 
    timestamps: true 
});

export const SystemJob = mongoose.model('SystemJob', systemJobSchema);
