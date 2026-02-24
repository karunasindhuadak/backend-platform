import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

const app = express();  // Create an Express application (server) and store it in app.

app.use(cors({           // “For every incoming request, run this helper (middleware) first.”
    origin: process.env.CORS_ORIGIN,
    credentials: true,  // Allow cookies, tokens, and authentication data.
}))

app.use(express.json({ limit: "16kb"}))  // This allows your backend to read JSON data sent by the frontend, up to 16 KB in size.
app.use(express.urlencoded({ extended: true})) // This allows your backend to read form-type data sent in requests.
app.use(express.static("public"))   // express.static("public") allows users to directly access files stored in the public folder through a URL.
app.use(cookieParser())     // cookie-parser reads cookies from the incoming HTTP request and makes them easy to use in your Express app.



// routes imports
import userRouter from "./routes/user.routes.js"
import videoRouter from "./routes/video.routes.js"


// routes declaration

app.use("/api/v1/users", userRouter)
app.use("/api/v1/videos", videoRouter)



export default app;