import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {deleteFromCloudinary, uploadOnCloudinary} from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
    
    //TODO: get all videos based on query, sort, pagination

    // get query parameters from frontend (page, limit, search text, sorting, user filter)
    // set default pagination values if not provided
    // build filter condition object for database query
    // if search query exists → add search condition for title/description
    // if userId exists → filter videos uploaded by that user
    // build sorting object based on sortBy and sortType
    // calculate how many documents to skip for pagination
    // fetch videos from database using filter + sorting + pagination
    // optionally populate owner details if needed
    // count total videos matching filter (for total pages info)
    // check if videos fetched successfully
    // return response with videos + pagination metadata


    // get query parameters from frontend (page, limit, search text, sorting, user filter)

    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query

    // set default pagination values if not provided

    const pageNumber = parseInt(page) || 1
    const limitNumber = parseInt(limit) || 10

    // build filter condition object for database query

    const filter = {}

    // if search query exists → add search condition for title/description

    if(query) {
        filter.$or = [
            {title: {$regex: query, $options: "i"}},
            {description: {$regex: query, $options: "i"}}
        ]
    }

    // if userId exists → filter videos uploaded by that user

    if(userId) {
        filter.owner = userId
    }

    // build sorting object based on sortBy and sortType

    const sort = {}

    if(sortBy && sortType) {
        sort[sortBy] = sortType === "asc" ? 1 : -1
    }

    // calculate how many documents to skip for pagination

    const skip = (pageNumber - 1) * limitNumber

    // fetch videos from database using filter + sorting + pagination

    const videos = await Video.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNumber)
        .populate("owner", "username fullName avatar")
    
    // count total videos matching filter (for total pages info)

    const totalVideos = await Video.countDocuments(filter)

    // check if videos fetched successfully

    if(!videos) {
        throw new ApiError(404, "Something went wrong while fetching videos")
    }

    // return response with videos + pagination metadata

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    videos,
                    totalVideos,
                    limit: limitNumber,
                    currentPage: pageNumber,
                    totalPages: Math.ceil(totalVideos / limitNumber)
                },
                "Videos fetched successfully"
            )
        )

})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body
    // TODO: get video, upload to cloudinary, create video

    if(!title?.trim() || !description?.trim()) {
        throw new ApiError(400, "Title and description are required")
    }

    const videoLocalPath = req.files?.video?.[0]?.path
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path

    if(!videoLocalPath) {
        throw new ApiError(400, "Video file is required")
    }

    if(!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail file is required")
    }

    const video = await uploadOnCloudinary(videoLocalPath)
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)

    if(!video || !thumbnail) {
        throw new ApiError(500, "Error uploading files to cloudinary")
    }

    if(!video?.duration) {
        throw new ApiError(500, "Error fetching video duration")
    }

    const newVideo = await Video.create({
        title: title.trim(),
        description: description.trim(),
        videoFile: {
            url: video.url,
            publicId: video.public_id
        },
        thumbnail: {
            url: thumbnail.url,
            publicId: thumbnail.public_id
        },
        owner: req.user._id,
        duration: video.duration
    })

    if(!newVideo) {
        throw new ApiError(500, "Error creating video")
    }

    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                newVideo,
                "Video published successfully"
            )
        )
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id
    if(!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const video = await Video.findByIdAndUpdate(
        videoId,
        { $inc: { views: 1 } },
        { new: true }
    ).populate("owner", "username fullName avatar")

    if(!video) {
        throw new ApiError(404, "Video not found")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                video,
                "Video fetched successfully"
            )
        )
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: update video details like title, description, thumbnail
    
    if(!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const video = await Video.findById(videoId)

    if(!video) {
        throw new ApiError(404, "Video not found")
    }

    const oldThumbnailPublicId = video.thumbnail?.publicId

    if(video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this video")
    }

    const { title, description } = req.body

    if(title && !title.trim()) {
        throw new ApiError(400, "Title can not be empty")
    }

    if(description && !description.trim()) {
        throw new ApiError(400, "Description can not be empty")
    }

    const thumbnailLocalPath = req.file?.path

    let newThumbnail = {}

    if(thumbnailLocalPath) {
        const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)

        if(!thumbnail) {
            throw new ApiError(500, "Error uploading thumbnail to cloudinary")
        }

        newThumbnail.url = thumbnail.url
        newThumbnail.publicId = thumbnail.public_id

    }

    if(title) video.title = title.trim()
    if(description) video.description = description.trim()
    if(newThumbnail.url && newThumbnail.publicId) {
        video.thumbnail.url = newThumbnail.url
        video.thumbnail.publicId = newThumbnail.publicId
    }

    const updatedVideo = await video.save()

    if(!updatedVideo) {
        throw new ApiError(500, "Error updating video")
    }

    if(oldThumbnailPublicId && newThumbnail.publicId && oldThumbnailPublicId !== newThumbnail.publicId) {
        // delete old thumbnail from cloudinary
        await deleteFromCloudinary(oldThumbnailPublicId)
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                updatedVideo,
                "Video updated successfully"
            )
        )



})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video

    if(!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const video = await Video.findById(videoId)

    if(!video) {
        throw new ApiError(404, "Video not found")
    }
    if(!video.owner.equals(req.user._id)) {
        throw new ApiError(403, "You are not authorized to delete this video")
    }

    const videoFilePublicId = video.videoFile?.publicId
    const thumbnailPublicId = video.thumbnail?.publicId

    // delete video file and thumbnail from cloudinary

    try {
        if(videoFilePublicId) {
            await deleteFromCloudinary(videoFilePublicId, "video")
        }
        if(thumbnailPublicId) {
            await deleteFromCloudinary(thumbnailPublicId, "image")
        }
    } catch (error) {
        console.error("Error deleting files from cloudinary: ", error)
    }

    const deletedVideo = await Video.deleteOne({ _id: videoId })

    if(deletedVideo.deletedCount !== 1) {
        throw new ApiError(500, "Error deleting video")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "Video deleted successfully"
            )
        )
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if(!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const video = await Video.findById(videoId)

    if(!video) {
        throw new ApiError(404, "Video not found")
    }

    if(!video.owner.equals(req.user._id)) {
        throw new ApiError(403, "You are not authorized to update this video")
    }

    video.isPublished = !video.isPublished

    const updatedVideo = await video.save()

    if(!updatedVideo) {
        throw new ApiError(500, "Error updating video publish status")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                updatedVideo,
                `Video ${updatedVideo.isPublished ? "published" : "unpublished"} successfully`
            )
        )
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}