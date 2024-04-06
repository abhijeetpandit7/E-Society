const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv')
const _ = require('lodash');
const session = require('express-session');
const passport = require('passport');
const user_collection = require("./models/userModel");
const society_collection = require("./models/societyModel");
const visit_collection = require("./models/visitModel");
const db = require(__dirname+'/config/db');
const date = require(__dirname+'/date/date');

// Access environment variables
dotenv.config();
const stripe = require('stripe')(process.env.SECRET_KEY);
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
	// Track page visits + users & societies registered
	visit_collection.Visit.findOne((err,pageVisit) => {
		if(!pageVisit){
			pageVisit = new visit_collection.Visit({
				count: 0
			})
		}
		pageVisit.count += 1;
		society_collection.Society.find((err,foundSociety) => {
			const societyCount = foundSociety.length
			const cities = foundSociety.map(society => society.societyAddress.city.toLowerCase())
			const cityCount = [...new Set(cities)].length
			user_collection.User.find((err,foundUser) => {
				const userCount = foundUser.length
				pageVisit.save(function() {
					const pageVisits = pageVisit.count
					res.render("index", {city:cityCount, society:societyCount, user:userCount, visit:pageVisits});
				})
			})
		})
	})	
});

app.get("/login", (req,res) => {
	res.render("login");
});

app.get("/signup", (req,res) => {
	society_collection.Society.find((err,foundSociety) => {
		res.render("signup", {societies: foundSociety});
	})
});

app.get("/register", (req,res) => {
	res.render("register");
});

app.get("/home", (req,res) => {
	if(req.isAuthenticated()){
		// Conditionally render home as per user validation status
		if(req.user.validation=='approved'){
			res.render("home");
		} else if(req.user.validation=='applied') {
			res.render("homeStandby",{
				icon: 'fa-user-clock',
				title: 'Account pending for approval',
				content: 'Your account will be active as soon as it is approved by your community.'+
                'It usually takes 1-2 days for approval. If it is taking longer to get approval, ' +
                'contact your society admin.'
			});
		} else {
			res.render("homeStandby",{
				icon: 'fa-user-lock',
				title: 'Account approval declined',
				content: 'Your account registration has been declined. '+
                'Please contact the society administrator for more details.' +
				'You can edit the request and apply again.'
			});
		}
	} else {
		res.redirect("/login");
	}
});

app.get("/newRequest", (req,res) => {
	if(req.isAuthenticated() && req.user.validation!='approved'){
		society_collection.Society.find((err,foundSociety) => {
			res.render("signupEdit", {user: req.user, societies: foundSociety});
		})
	} else {
		res.redirect("/home")
	}
})

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
	if(req.isAuthenticated() && req.user.validation=='approved'){
		const userSocietyName = req.user.societyName;
		user_collection.User.find({$and: [{"societyName":userSocietyName}, {"validation":"approved"}]},
		(err,foundUsers) => {
			if(!err && foundUsers){
				// Fetch users with applied status
				user_collection.User.find({$and: [{"societyName":userSocietyName}, {"validation":"applied"}]},
				(err,foundAppliedUsers) => {
					if(!err && foundAppliedUsers){
						res.render("residents", {
							societyResidents: foundUsers, 
							appliedResidents: foundAppliedUsers,
							societyName: userSocietyName,
							isAdmin: req.user.isAdmin
						});
					}
				})
			}
		})
	} else {
		res.redirect("/login");
	}
})

app.get("/noticeboard", (req,res) => {
	if(req.isAuthenticated() && req.user.validation=='approved'){
		society_collection.Society.findOne({societyName: req.user.societyName}, (err,foundSociety) => {
			if(!err && foundSociety){
				// Check if no notice is present
				if(!foundSociety.noticeboard.length){
					foundSociety.noticeboard = [{
						'subject': 'Access all important announcements, notices and circulars here.'
					}]
				}
				res.render("noticeboard", {notices:foundSociety.noticeboard, isAdmin:req.user.isAdmin});
			}
		})	
	} else {
		res.redirect("/login");
	}
})

app.get("/notice", (req,res) => {
	if(req.isAuthenticated() && req.user.isAdmin){
		res.render("notice");
	} else {
		res.redirect("/login");
	}
})

app.get("/bill", (req,res) => {
	if(req.isAuthenticated() && req.user.validation=='approved'){
		user_collection.User.findById(req.user.id, (err, foundUser) => {
			if(!err && foundUser){
				society_collection.Society.findOne({societyName: foundUser.societyName}, (err,foundSociety) => {
					const dateToday = new Date();
					// Payment required for total number of months
					let totalMonth = 0
					// If lastPayment doesn't exists
					let dateFrom = foundUser.createdAt;
					// If lastPayment exists
					if(foundUser.lastPayment.date){
						dateFrom = foundUser.lastPayment.date;
						totalMonth = date.monthDiff(dateFrom,dateToday)
					}
					else {
						// Add an extra month, as users joining date month payment's also pending
						totalMonth = date.monthDiff(dateFrom,dateToday) + 1
					}
					// Calculate monthly bill of society maintenance
					const monthlyTotal  = Object.values(foundSociety.maintenanceBill)
						.filter(ele => typeof(ele)=='number')
						.reduce((sum,ele) => sum+ele, 0)
					let credit = 0;
					let due = 0;
					if(totalMonth==0){
						// Calculate credit balance
						credit = monthlyTotal;
					}
					else if(totalMonth>1){
						// Calculate pending due
						due =  (totalMonth-1)*monthlyTotal
					}
					const totalAmount = monthlyTotal + due - credit
					
					// Fetch validated society residents for admin features
					user_collection.User.find({$and: [{"societyName":req.user.societyName}, {"validation":"approved"}]},(err,foundUsers) => {
						if(!err && foundUsers){
							// Update amount to be paid on respective user collection
							user_collection.User.findOne({_id: req.user.id}, (err,foundUser) => {
								foundUser.makePayment = totalAmount;
								foundUser.save(function() {
									res.render("bill", {
										resident:foundUser, 
										society:foundSociety,
										totalAmount: totalAmount,
										pendingDue: due,
										creditBalance: credit,
										monthName: date.month,
										date: date.today,
										year: date.year,
										receipt: foundUser.lastPayment,
										societyResidents:foundUsers,
										monthlyTotal: monthlyTotal
									});
								})
							})
						}
					})
				})
			}
		})	
	} else {
		res.redirect("/login");
	}
})

app.get("/editBill", (req,res) => {
	if(req.isAuthenticated() && req.user.isAdmin){
		society_collection.Society.findOne({societyName: req.user.societyName}, (err, foundSociety) => {
			if(!err && foundSociety){
				res.render("editBill", {maintenanceBill:foundSociety.maintenanceBill});
			}
		})
	} else {
		res.redirect("/login");
	}
})

app.get("/helpdesk",(req,res) => {
	if(req.isAuthenticated() && req.user.validation=='approved') {
		// Conditonally render user/admin helpdesk
		if(req.user.isAdmin) {
			user_collection.User.find({$and: [{"societyName":req.user.societyName}, {"validation":"approved"}]}, (err, foundUsers) => {
				if(!err && foundUsers) {
					res.render("helpdeskAdmin", {users:foundUsers});
				}
			})
		} else {
			// Check if no complaint is present
			if(!req.user.complaints.length){
				req.user.complaints = [{
					'category': 'You have not raised any complaint',
					'description': 'You can raise complaints and track their resolution by facility manager.'
				}]
			}
			res.render("helpdesk", {complaints:req.user.complaints});
		}
	} else {
		res.redirect("/login");
	}
})

app.get("/complaint",(req,res) => {
	if(req.isAuthenticated() && req.user.validation=='approved'){
		res.render("complaint");
	} else {
		res.redirect("/login");
	}
})

app.get("/contacts",(req,res) => {
	if(req.isAuthenticated()  && req.user.validation=='approved'){
		const userSocietyName = req.user.societyName;
		society_collection.Society.findOne({"societyName":userSocietyName},(err,foundSociety) => {
			if(!err && foundSociety){
				res.render("contacts", {contact:foundSociety.emergencyContacts, isAdmin: req.user.isAdmin});
			}
		})	
	} else {
		res.redirect("/login");
	}
})

app.get("/editContacts",(req,res) => {
	if(req.isAuthenticated() && req.user.isAdmin){
		society_collection.Society.findOne({societyName: req.user.societyName}, (err, foundSociety) => {
			if(!err && foundSociety){
				res.render("editContacts", {contact:foundSociety.emergencyContacts});
			}
		})	
	} else {
		res.redirect("/login");
	}
})

app.get("/profile", (req,res) => {
	if(req.isAuthenticated()  && req.user.validation=='approved'){
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

app.get("/editProfile", (req,res) => {
	if(req.isAuthenticated() && req.user.validation=='approved'){
		user_collection.User.findById(req.user.id, (err, foundUser) => {
			if(!err && foundUser){
				society_collection.Society.findOne({societyName: foundUser.societyName}, (err,foundSociety) => {
					res.render("editProfile", {resident:foundUser, society:foundSociety});
				})				
			}
		})	
	} else {
		res.redirect("/login");
	}
})

app.get('/success', async (req, res) => {
	const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
	const customer = await stripe.customers.retrieve(session.customer);
	// Update payment made details for respective user
	user_collection.User.findOne({_id: req.user.id}, (err,foundUser) => {
		foundUser.lastPayment.date = new Date(customer.created*1000);
		foundUser.lastPayment.amount = session.amount_total/100;
		foundUser.lastPayment.invoice = customer.invoice_prefix;
		foundUser.save(function() {
			const transactionDate = new Date(customer.created*1000).toLocaleString().split(', ')[0]
			res.render("success", {
				invoice: customer.invoice_prefix, 
				amount: session.amount_total/100, 
				date: transactionDate
			});
		})
	})
});

app.post('/checkout-session', async (req, res) => {
	const session = await stripe.checkout.sessions.create({
	  payment_method_types: ['card'],
	  line_items: [
		{
		  price_data: {
			currency: 'inr',
			product_data: {
			  name: req.user.societyName,
			  images: ['https://www.flaticon.com/svg/vstatic/svg/3800/3800518.svg?token=exp=1615226542~hmac=7b5bcc7eceab928716515ebf044f16cd'],
			},
			unit_amount: req.user.makePayment*100,
		  },
		  quantity: 1,
		},
	  ],
	  mode: 'payment',
	//   success_url: "http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}",
	//   cancel_url: "http://localhost:3000/bill",
	  success_url: "https://esociety-fdbd.onrender.com/https://esociety-fdbd.onrender.com//success?session_id={CHECKOUT_SESSION_ID}",
	  cancel_url: "https://esociety-fdbd.onrender.com/https://esociety-fdbd.onrender.com//bill",
	});
  
	res.json({ id: session.id });
  });

  app.post("/approveResident",(req,res) => {
	const user_id = Object.keys(req.body.validate)[0]
	const validate_state = Object.values(req.body.validate)[0]
	user_collection.User.updateOne(
		{_id:user_id},
		{ $set: {
			validation: validate_state
		}},
		(err,result) => {
			if(!err){
				res.redirect("/residents");
			}
		}
	)
})

app.post("/complaint",(req,res) => {
	user_collection.User.findById(req.user.id, (err, foundUser) => {
		if(!err && foundUser){
			complaint = {
				'date': date.dateString,
				'category': req.body.category,
				'type': req.body.type,
				'description': req.body.description,
				'status': 'open'
			}
			foundUser.complaints.push(complaint);
			foundUser.save(function() {
				res.redirect("/helpdesk");
			})
		}
	})
})

app.post("/closeTicket",(req,res) => {
	const user_id = Object.keys(req.body.ticket)[0]
	const ticket_index = Object.values(req.body.ticket)[0]
	const ticket = 'complaints.'+ticket_index
	// Find user for fetching ticket data
	user_collection.User.findById(user_id, (err, foundUser) => {
		if(!err && foundUser){
			user_collection.User.updateOne(
				{_id:user_id},
				{ $set: {
					[ticket]: {
						status: 'close',
						'date': foundUser.complaints[ticket_index].date,
						'category': foundUser.complaints[ticket_index].category,
						'type': foundUser.complaints[ticket_index].type,
						'description': foundUser.complaints[ticket_index].description
					}
				}},
				(err,result) => {
					if(!err){
						res.redirect("/helpdesk");
					}
				}
			)		
		}
	})
})

app.post("/notice",(req,res) => {
	society_collection.Society.findOne({societyName: req.user.societyName}, (err,foundSociety) => {
		if(!err && foundSociety){
			notice = {
				'date': date.dateString,
				'subject': req.body.subject,
				'details': req.body.details
			}
			foundSociety.noticeboard.push(notice);
			foundSociety.save(function() {
				res.redirect("/noticeboard");
			})
		}
	})
})

app.post("/editBill",(req,res) => {
	society_collection.Society.updateOne(
		{societyName: req.user.societyName}, 
		{ $set: {
			maintenanceBill: {
				societyCharges: req.body.societyCharges,
				repairsAndMaintenance: req.body.repairsAndMaintenance,
				sinkingFund: req.body.sinkingFund,
				waterCharges: req.body.waterCharges,
				insuranceCharges: req.body.insuranceCharges,
				parkingCharges: req.body.parkingCharges
			}
		}},
		(err,result) => {
			if(!err){
				res.redirect("/bill");
			}
		}
	)
})

app.post("/editContacts",(req,res) => {
	society_collection.Society.updateOne(
		{societyName: req.user.societyName}, 
		{ $set: {
			emergencyContacts: {
				plumbingService: req.body.plumbingService,
				medicineShop: req.body.medicineShop,
				ambulance: req.body.ambulance,
				doctor: req.body.doctor,
				fireStation: req.body.fireStation,
				guard: req.body.guard,
				policeStation: req.body.policeStation
			}
		}},
		(err,result) => {
			if(!err){
				res.redirect("/contacts");
			}
		}
	)
})

app.post("/editProfile",(req,res) => {
	user_collection.User.updateOne(
		{_id: req.user.id}, 
		{ $set: { 
			firstName: req.body.firstName,
			lastName: req.body.lastName,
			phoneNumber: req.body.phoneNumber,
			flatNumber: req.body.flatNumber
		}},
		(err,result) => {
			if(!err){
				// Update society data if any ~admin
				if(req.body.address){
					society_collection.Society.updateOne(
						{admin: req.user.username}, 
						{ $set: { 
							societyAddress: {
								address: req.body.address,
								city: req.body.city,
								district: req.body.district,
								postalCode: req.body.postalCode
							}
						}},
						(err,result) => {
							if(!err){
								res.redirect("/profile");
							}
						}
					)
				}
				else {
					res.redirect("/profile");
				}
			}
		}
	)
})

app.post("/newRequest", (req,res) => {
	// Submit new signup only if society exists
	society_collection.Society.findOne({societyName: req.body.societyName}, (err,foundSociety) => {
		if(!err && foundSociety){
			user_collection.User.updateOne(
				{_id: req.user.id}, 
				{ $set: {
					firstName: req.body.firstName,
					lastName: req.body.lastName,
					phoneNumber: req.body.phoneNumber,
					societyName: req.body.societyName,
					flatNumber: req.body.flatNumber,
					validation: 'applied'
				}},
				(err,result) => {
					if(!err){
						res.redirect("/home");
					}
				}
			);
		}
		else{
			const failureMessage = "Sorry, society is not registered, Please double-check society name."
			const hrefLink = "/newRequest"
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
						const failureMessage = "Sorry, this email address is not available. Please choose a different address.";
						const hrefLink = "/signup";
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
					validation: 'approved',
					isAdmin: true,
					username: req.body.username,
					societyName: req.body.societyName,
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
									address: req.body.address,
									city: req.body.city,
									district: req.body.district,
									postalCode: req.body.postalCode
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