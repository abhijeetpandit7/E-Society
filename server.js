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

app.get("/logout", (req,res) => {
	req.logout();
	res.redirect("/")
})

app.get("/loginFailure", (req,res) => {
	const failureMessage = "Sorry, entered password was incorrect, Please double-check.";
	const hrefLink = "/login";
	const secondaryMessage = "Account not created?";
	const hrefSecondaryLink = "/signup";
	const secondaryButton = "Create Account";
	res.render("failure",{
		message:failureMessage,
		href:hrefLink,
		messageSecondary:secondaryMessage,
		hrefSecondary:hrefSecondaryLink,
		buttonSecondary:secondaryButton
	})
});

app.get("/residents", (req,res) => {
	if(req.isAuthenticated()){
		const userSocietyName = req.user.societyName;
		user_collection.User.find({"societyName":userSocietyName},(err,foundUsers) => {
			if(!err && foundUsers){
				res.render("residents", {societyResidents:foundUsers, societyName:userSocietyName});
			}
		})
	} else {
		res.redirect("/login");
	}
})

app.get("/bill", (req,res) => {
	if(req.isAuthenticated()){
		user_collection.User.findById(req.user.id, (err, foundUser) => {
			if(!err && foundUser){
				society_collection.Society.findOne({societyName: foundUser.societyName}, (err,foundSociety) => {
					const date = new Date();
					const today = date.toLocaleString().split(',')[0];
					const month = date.toLocaleString("default", { month: "long" });
					const year = today.split('/')[2]
					res.render("bill", {
						resident:foundUser, 
						society:foundSociety,
						monthName: month,
						date: today,
						year: year
					});
				})
			}
		})	
	} else {
		res.redirect("/login");
	}
})

app.get("/helpdesk",(req,res) => {
	res.render("helpdesk");
})

app.get("/contacts",(req,res) => {
	if(req.isAuthenticated()){
		const userSocietyName = req.user.societyName;
		user_collection.User.findOne({"societyName":userSocietyName, isAdmin: true},(err,foundUser) => {
			if(!err && foundUser){
				res.render("contacts", {phone:foundUser.phoneNumber});
			}
		})	
	} else {
		res.redirect("/login");
	}
})

app.get("/profile", (req,res) => {
	if(req.isAuthenticated()){
		user_collection.User.findById(req.user.id, (err, foundUser) => {
			if(!err && foundUser){
				society_collection.Society.findOne({societyName: foundUser.societyName}, (err,foundSociety) => {
					res.render("profile", {resident:foundUser, society:foundSociety});
				})
			}
		})	
	} else {
		res.redirect("/login");
	}
})

app.post("/signup", (req,res) => {
	// Signup only if society is created
	society_collection.Society.findOne({societyName: req.body.societyName}, (err,foundSociety) => {
		if(!err && foundSociety){
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
			const failureMessage = "Sorry, society is not registered, Please double-check society name."
			const hrefLink = "/signup"
			const secondaryMessage = "Society not registered?";
			const hrefSecondaryLink = "/register";
			const secondaryButton = "Register Society";
			res.render("failure",{
				message:failureMessage,
				href:hrefLink,
				messageSecondary:secondaryMessage,
				hrefSecondary:hrefSecondaryLink,
				buttonSecondary:secondaryButton
			});
		}
	});
});

app.post("/register", (req,res) => {
	// Signup only if society not registered
	society_collection.Society.findOne({societyName: req.body.societyName},function(err,result){
		if(!err && !result){
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
		}
		else{
			const failureMessage = "Sorry, society is already registered, Please double-check society name.";
			const hrefLink = "/register";
			const secondaryMessage = "Account not created?";
			const hrefSecondaryLink = "/signup";
			const secondaryButton = "Create Account";
			res.render("failure",{
				message:failureMessage,
				href:hrefLink,
				messageSecondary:secondaryMessage,
				hrefSecondary:hrefSecondaryLink,
				buttonSecondary:secondaryButton
			});
		}
	});
});

app.post("/login", passport.authenticate("local", {
	successRedirect: "/home",
	failureRedirect: "/loginFailure"
}));

app.listen(
    process.env.PORT || 3000, 
    console.log("Server started")
);