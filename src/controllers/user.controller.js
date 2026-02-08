import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"



const generateAccessTokenAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access and refresh token")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    
    // console.log("REQ.BODY: ", req.body)
    const {username, email, fullName, password} = req.body
    // console.log("email: ", email)

    if(
        [username, email, fullName, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    const existUser = await User.findOne({
        $or: [{username}, {email}]
    })

    if(existUser) {
        throw new ApiError(409, "username or email already exist")
    }
    // console.log("REQ.FILES: ", req.files)
    const avatarLocalPath = req.files?.avatar[0]?.path
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path
    // console.log("CoverImageLocalPath: ", coverImageLocalPath)

    // let coverImageLocalPath

    // if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage > 0) {
    //     coverImageLocalPath = req.files.coverImage[0].path
    // }

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is requred")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    // const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    let coverImage
    if(coverImageLocalPath) {
        coverImage = await uploadOnCloudinary(coverImageLocalPath)
    } else {
        coverImage = null
    }
    // console.log("CoverImage: ", coverImage)
    // console.log("CoverImageUrl: ", coverImage?.url)


    if(!avatar) {
        throw new ApiError(400, "Avatar file is requred")
    }

    const user = await User.create({
        username: username.toLowerCase(),
        email,
        password,
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
    })

    const userCreated = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!userCreated) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, userCreated, "User registered succesfully")
    )
})

const loginUser = asyncHandler(async (req, res) => {
    
        const {username, email, password} = req.body

        if(!(username || email)) {
            throw new ApiError(400, "username or email is required")
        }

        const user = await User.findOne({
            $or: [{username}, {email}]
        })

        if(!user) {
            throw new ApiError(404, "User does not found")
        }

        const isCorrectPasword = await user.isPasswordCorrect(password)

        if(!isCorrectPasword) {
            throw new ApiError(401, "password is incorrect")
        }


        const {accessToken, refreshToken} = await generateAccessTokenAndRefreshToken(user._id)

        const loggedInUser = await User.findById(user._id)

        const options = {
            httpOnly: true,
            secure: true
        }

        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User logged In Succesfully"
            )
        )

})


const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(200, {}, "User logged out Successfully")
    )
})


const refreshAccessToken = asyncHandler( async (req, res) => {
   
    try {
        const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken
    
        if(!incomingRefreshToken) {
            throw new ApiError(401, "Unauthorized request")
        }
    
        const decodedData = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedData?._id)
    
        if(!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if(incomingRefreshToken !== user.refreshToken) {
            throw new ApiError(401, "Invalid refresh token or expired refresh token")
        }
    
        const {accessToken, newRefreshToken} = await user.generateAccessTokenAndRefreshToken()
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newRefreshToken},
                "Token refresh succesfully"
            )
        )
    } catch (error) {
        throw new ApiError(200, error?.message || "Invalid refresh token")
    }
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
}