const mongoose = require('mongoose');

exports.connectDB = async() => {
    try{
        const connection = await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB connected: "+connection.connection.host)
    }
    catch(error){
        console.error("Error "+error.message);
        process.exit(1);
    }
}