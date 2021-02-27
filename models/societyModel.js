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
        noticeboard: Array
    },
    {
		timestamps: true,
	}
)

exports.Society = mongoose.model("society", societySchema);