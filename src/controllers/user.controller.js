import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessTokenAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating access and refresh token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // console.log("REQ.BODY: ", req.body)
  const { username, email, fullName, password } = req.body;
  // console.log("email: ", email)

  if (
    [username, email, fullName, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existUser) {
    throw new ApiError(409, "username or email already exist");
  }
  // console.log("REQ.FILES: ", req.files)
  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;
  // console.log("CoverImageLocalPath: ", coverImageLocalPath)

  // let coverImageLocalPath

  // if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage > 0) {
  //     coverImageLocalPath = req.files.coverImage[0].path
  // }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is requred");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
    console.log("Cloudinary response on avatar uplod: ", avatar)
  // const coverImage = await uploadOnCloudinary(coverImageLocalPath)
  let coverImage;
  if (coverImageLocalPath) {
    coverImage = await uploadOnCloudinary(coverImageLocalPath);
  } else {
    coverImage = null;
  }
  // console.log("CoverImage: ", coverImage)
  // console.log("CoverImageUrl: ", coverImage?.url)

  if (!avatar) {
    throw new ApiError(400, "Avatar file is requred");
  }

  const user = await User.create({
    username: username.toLowerCase(),
    email,
    password,
    fullName,
    avatar: {
      url: avatar.url,
      publicId: avatar.public_id,
    },
    coverImage: coverImage
      ? {
          url: coverImage.url,
          publicId: coverImage.public_id,
        }
      : undefined,
  });

  const userCreated = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!userCreated) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, userCreated, "User registered succesfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!(username || email)) {
    throw new ApiError(400, "username or email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User does not found");
  }

  const isCorrectPasword = await user.isPasswordCorrect(password);

  if (!isCorrectPasword) {
    throw new ApiError(401, "password is incorrect");
  }

  const { accessToken, refreshToken } =
    await generateAccessTokenAndRefreshToken(user._id);

  const loggedInUser = await User.findById(user._id);

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged In Succesfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out Successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  try {
    const incomingRefreshToken =
      req.cookies?.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
      throw new ApiError(401, "Unauthorized request");
    }

    const decodedData = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedData?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "Invalid refresh token or expired refresh token");
    }

    const { accessToken, newRefreshToken } =
      await user.generateAccessTokenAndRefreshToken();

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Token refresh succesfully"
        )
      );
  } catch (error) {
    throw new ApiError(200, error?.message || "Invalid refresh token");
  }
});

const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user?._id);

  const isOldPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isOldPasswordCorrect) {
    throw new ApiError(400, "Incorrect password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed succesfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User data fetched succesfully"));
});

const updateUserDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  console.log("fullName: ", fullName);

  if (!fullName || !email) {
    throw new ApiError(400, "fullName and email both are required");
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName, // fullName: fullName
        email,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedUser, "User details updated succesfully")
    );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  // Delete old image - Assignment

  const oldAvatar = await User.findById(req.user?._id).select("avatar");

//   console.log("OldAvatar: ", oldAvatar)

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(
      500,
      "Something went wrong while uploading avatar image"
    );
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { avatar: {
        url: avatar.url,
        publicId: avatar.public_id
      } },
    },
    {
      new: true,
    }
  ).select("-password");

  const result = await deleteFromCloudinary(oldAvatar?.avatar?.publicId)

//   console.log("Cloudinary deletion result: ", result)

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated succesfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "CoverImage file is required");
  }

  // Delete old image - Assignment

  const oldCoverImage = await User.findById(req.user?._id).select("coverImage");

//   console.log("OldCoverImage: ", oldCoverImage)

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

//   console.log("Cloudinary response on cover image uplod: ", coverImage)

  if (!coverImage.url) {
    throw new ApiError(
      500,
      "Something went wrong while uploading cover image"
    );
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { coverImage: {
        url: coverImage.url,
        publicId: coverImage.public_id
      } },
    },
    {
      new: true,
    }
  ).select("-password");

  const result = await deleteFromCloudinary(oldCoverImage?.coverImage?.publicId)

//   console.log("Cloudinary deletion result: ", result)

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Coverimage updated succesfully"));
});

const getUserProfile = asyncHandler(async (req, res) => {
  const {username} = req.params
  if(!username?.trim()) {
    throw new ApiError(401, "Username not exist")
  }

  const channal = await User.aggregate([
    {
      $match: {
        username: username.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        subscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        email: 1,
        avatar: 1,
        coverImage: 1,
        subscribersCount: 1,
        subscribedToCount: 1,
        isSubscribed: 1,
      }
    }
  ]);

  if(!channal || channal.length === 0) {
    throw new ApiError(404, "User not found")
  }

  return res
  .status(200)
  .json(new ApiResponse(200, channal[0], "User profile fetched succesfully"))
})

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changePassword,
  getCurrentUser,
  updateUserDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserProfile
};
