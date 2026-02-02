import dotenv from "dotenv";
import connectDB from "./db/index.js";
import app from "./app.js";

// import express from "express";
// import mongoose from "mongoose";
// import {DB_NAME} from "./constants.js";

dotenv.config({
  path: "./.env",
});

const Port = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(Port, () => {
      console.log(`\n Server is running on port: ${Port}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed !! ", error);
  });

/*
const app = express();
;(async() => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("Error", (error) => {
            console.log("Error event triggered:", error);
            throw error;
        })
        app.listen(process.env.PORT, () => {
            console.log(`Server is running on port ${process.env.PORT}`);
        })
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        throw error;
    }
})()

*/
