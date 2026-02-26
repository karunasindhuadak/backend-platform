import mongoose, { isValidObjectId } from "mongoose"
import {Comment} from "../models/comment.model.js"
import {Video} from "../models/video.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query

    if(!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID")
    }

    const pageNumber = parseInt(page) || 1
    const limitNumber = parseInt(limit) || 10

    const skip = (pageNumber - 1) * limitNumber

    const comments = await Comment
                            .find({video: videoId})
                            .populate("owner", "username avatar")
                            .sort({createdAt: -1})
                            .skip(skip)
                            .limit(limitNumber)

    const totalComments = await Comment.countDocuments({video: videoId})
    const totalPages = Math.ceil(totalComments / limitNumber)

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    comments,
                    pagination: {
                        totalComments,
                        totalPages,
                        currentPage: pageNumber,
                    }
                },
                "Comments retrieved successfully"
            )
        )
})

const addComment = asyncHandler(async (req, res) => {
    // TODO: add a comment to a video
    const {videoId} = req.params
    const {content} = req.body
    
    if(!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    if(!content || !content.trim()) {
        throw new ApiError(400, "Comment content cannot be empty")
    }

    const video = await Video.findById(videoId)

    if(!video) {
        throw new ApiError(404, "Video not found")
    }

    const newComment = await Comment.create({
        content: content.trim(),
        video: videoId,
        owner: req.user._id
    })

    await newComment.populate("owner", "username avatar")

    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                newComment,
                "Comment added successfully"
            )
        )
})

const updateComment = asyncHandler(async (req, res) => {
    // TODO: update a comment
    const {commentId} = req.params
    const {content} = req.body

    if(!content || !content.trim()) {
        throw new ApiError(400, "Comment content cannot be empty")
    }

    const comment = await Comment.findById(commentId)

    if(!comment) {
        throw new ApiError(404, "Comment not found")
    }

    if(!comment.owner.equals(req.user._id)) {
        throw new ApiError(403, "You are not authorized to update this comment")
    }

    comment.content = content.trim()
    await comment.save()

    await comment.populate("owner", "username avatar")

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                comment,
                "Comment updated successfully"
            )
        )
})

const deleteComment = asyncHandler(async (req, res) => {
    // TODO: delete a comment
    const {commentId} = req.params

    if(!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID")
    }

    const deletedComment = await Comment.findOneAndDelete({
        _id: commentId,
        owner: req.user._id
    })
    
    if(!deletedComment) {
        throw new ApiError(404, "Comment not found or you are not authorized to delete this comment")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "Comment deleted successfully"
            )
        )
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
     deleteComment
    }