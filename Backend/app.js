const express=require("express");
const bodyParser=require("body-parser");
const https=require("https");
const mongoose=require('mongoose');
//const encrypt = require('mongoose-encryption');
//const md5 = require('md5');
const bcrypt = require('bcrypt');
const saltRounds = 1;

const app=express();
app.set('view engine','ejs');
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static("public"));

mongoose.connect('mongodb://localhost:27017/E-SocietyDB', {
    useUnifiedTopology: true,
    useNewUrlParser: true})
    .then(() => console.log("Connected to Database"))
    .catch(err => console.error("An error has occured", err));
	
const memberSchema =new mongoose.Schema({
	 Fname:String,
     LName:String,
	 Society:String,
	 flatno: Number,
     Phone:Number,
	 password: String
	
	
});

const noticeSchema=new mongoose.Schema({
	Date:Number,
	notice:String
}
)

const Member=new mongoose.model("Member",memberSchema);	
const Notice=new mongoose.model("Member",noticeSchema);	

app.get("/",function(request,response){
	response.render("index");
});

app.get("/register",function(request,response){
	response.render("register");
	});

app.get("/login",function(request,response){
	response.render("login");
});

app.get("/test",function(request,response){
	response.send("LOGIN SUCCESSFUL");
});

app.post("/register", function(req,res){
   bcrypt.hash(req.body.password,saltRounds,function(err,hash){
     const newMem=new Member({
	  Fname:req.body.fname,
      LName:req.body.lname,
	  Society:req.body.soc,
	  flatno:req.body.flat,
      Phone:req.body.phone,
	  password:hash
	  });
	  
	  newMem.save(function(err){
	     if(err){
		   console.log(err);
		 }else{
		    res.render("login");
		 }
	  
	  });
	  
   });
});

app.post("/login",function(request,response){
	const society=request.body.soc;
	const flatno=request.body.flat;
	const password=request.body.password;
	//console.log(password);
	//console.log("rosh")
	Member.find(({Society:society,flatno:flatno}),function(err,foundUser){
		
		if(err){
			console.log("error");
			console.log(err)
		}else{
			
			if(foundUser){

				bcrypt.compare(password,foundUser.password,function(err){
					console.log("Success03");
					//console.log(foundUser.password);
					if(err){
						console.log(err);
					}else{
						console.log("Success");
						response.redirect("/");
					}
				});
			}
			
		}
	});
});


app.listen(3000,function(){
	console.log("Server is running");
});

