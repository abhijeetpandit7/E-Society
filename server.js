const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv')
const _ = require('lodash');
const session = require('express-session');
const passport = require('passport');
const user_collection = require("./models/userModel");
const society_collection = require("./models/societyModel");
const db = require(__dirname+'/config/db');

// Access environment variables
dotenv.config();
const app = express()
app.set('view engine','ejs');
app.use(express.static('public'));
// Middleware to handle HTTP post requests
app.use(bodyParser.urlencoded({extended: true}));
app.use(session({
	secret:"This is the secret key",
	resave:false,
	saveUninitialized:false
}));
app.use(passport.initialize());
app.use(passport.session());
db.connectDB()

app.get("/", (req,res) => {
	res.render("index");
});

app.get("/login", (req,res) => {
	res.render("login");
});

app.get("/signup", (req,res) => {
	res.render("signup");
});

app.get("/register", (req,res) => {
	res.render("register");
});

app.get("/home", (req,res) => {
	if(req.isAuthenticated()){
		res.render("home");
	} else {
		res.redirect("/login");
	}
});

app.get("/failure", (req,res) => {
	res.render("failure");
});

app.post("/signup", (req,res) => {
	// Signup only if society is created
	society_collection.Society.findOne({societyName: req.body.societyName},function(err,result){
		if(!err && result){
			user_collection.User.register(
				{
					username: req.body.username,
					societyName: req.body.societyName,
					flatNumber: req.body.flatNumber,
					firstName: req.body.firstName,
					lastName: req.body.lastName,
					phoneNumber: req.body.phoneNumber
				},
				req.body.password,function(err,user){
					if(err){
						console.log(err);
						res.redirect("/signup");
					} else {
						passport.authenticate("local")(req,res,function(){
							res.redirect("/home");
						});
					}
				}
			);
		}
		else{
			res.redirect("failure")
		}
	});
});

app.post("/register", (req,res) => {
	user_collection.User.register(
		{
			isAdmin: true,
			username: req.body.username,
			societyName: req.body.societyName,
			societyAddress: {
				address: req.body.address,
				city: req.body.city,
				district: req.body.district,
				postalCode: req.body.postalCode
			},
			flatNumber: req.body.flatNumber,
			firstName: req.body.firstName,
			lastName: req.body.lastName,
			phoneNumber: req.body.phoneNumber
		},
		req.body.password,(err,user) => {
			if(err){
				console.log(err);
				res.redirect("/register");
			} else {
				passport.authenticate("local")(req,res,function(){
					// Create new society in collection
					const society = new society_collection.Society({
						societyName: user.societyName,
						societyAddress: {
							address: user.societyAddress.address,
							city: user.societyAddress.city,
							district: user.societyAddress.district,
							postalCode: user.societyAddress.postalCode
						},
						admin: user.username
					});
					society.save();
					res.redirect("/home");
				});
			}
		}
	);
});

app.post("/login", passport.authenticate("local", {
	successRedirect: "/home",
	failureRedirect: "/failure"
}));

app.listen(
    process.env.PORT || 3000, 
    console.log("Server started")
);