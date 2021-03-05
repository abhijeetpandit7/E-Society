const mongoose = require('mongoose');

const societySchema = mongoose.Schema(
    {
        societyName: {
            type: String,
            unique: true,
            required: true
        },
        societyAddress: {
            address: {
                type: String,
                required: true
            },
            city: {
                type: String,
                required: true
            },
            district: {
                type: String,
                required: true
            },
            postalCode: {
                type: Number,
                required: true
            }
        },
        admin: {
            type: String,
            required: true
        },
        noticeboard: Array,
        emergencyContacts: {
            plumbingService: {
                type: String,
                default: 'Not added by admin'
            },
            medicineShop: {
                type: String,
                default: 'Not added by admin'
            },
            ambulance: {
                type: String,
                default: 'Not added by admin'
            },
            doctor: {
                type: String,
                default: 'Not added by admin'
            },
            fireStation: {
                type: String,
                default: 'Not added by admin'
            },
            guard: {
                type: String,
                default: 'Not added by admin'
            },
            policeStation: {
                type: String,
                default: 'Not added by admin'
            }
        }
    },
    {
		timestamps: true,
	}
)

exports.Society = mongoose.model("society", societySchema);