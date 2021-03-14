const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');
const passport = require('passport');

const userSchema = new mongoose.Schema (
	{
		validation: {
			type: String,
			required: true,
			default: 'applied'
		},
		isAdmin: {
			type: Boolean,
			required: true,
			default: false
		},
		societyName: {
			type: String,
			required: true
		},
		flatNumber: {
			type: String,
			required: true
		},
		firstName: {
			type: String,
			required: true
		},
		lastName: {
			type: String,
			required: true
		},
		phoneNumber: {
			type: Number,
			required: true
		},
		complaints: Array,
		lastPayment: {
			date: Date,
			amount: Number,
			invoice: String
		},
		makePayment: Number
	},
	{
		timestamps: true
	}
);

userSchema.plugin(passportLocalMongoose);
const User = mongoose.model("User",userSchema);
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
exports.User = User