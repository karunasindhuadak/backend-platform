import mongoose, {isValidObjectId} from "mongoose"
import {Playlist} from "../models/playlist.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const createPlaylist = asyncHandler(async (req, res) => {
    const {name, description} = req.body
    //TODO: create playlist

    if(!name || !name.trim()) {
        throw new ApiError(400, "Playlist name is required")
    }

    if(!description || !description.trim()) {
        throw new ApiError(400, "Playlist description is required")
    }

    if(!req.user) {
        throw new ApiError(401, "Unauthorized")
    }

    const playlist = await Playlist.create({
        name: name.trim(),
        description: description.trim(),
        owner: req.user._id,
        videos: []
    })

    if(!playlist) {
        throw new ApiError(500, "Failed to create playlist")
    }

    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                playlist,
                "Playlist created successfully"
            )
        )
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const {userId} = req.params
    //TODO: get user playlists
    if(!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user id")
    }

    const existUser = await mongoose.model("User").exists({_id: userId})

    if(!existUser) {
        throw new ApiError(404, "User not found")
    }

    const filter = {owner: userId}

    if( !req.user || req.user._id.toString() !== userId) {
        filter.isPrivate = false
    }

    const playlists = await Playlist.find(filter).populate("videos", "title description thumbnail duration")

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                playlists,
                "Playlists fetched successfully"
            )
        )
})

const getPlaylistById = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    //TODO: get playlist by id

    if(!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist id")
    }

    const playlist = await Playlist.findById(playlistId)

    if(!playlist) {
        throw new ApiError(404, "Playlist not found")
    }

    if(playlist.isPrivate === true && (!req.user || req.user._id.toString() !== playlist.owner.toString())) {
        throw new ApiError(404, "Playlist not found")
    }

    await playlist.populate("videos", "title description thumbnail duration")

    const playlistObject = playlist.toObject()
    playlistObject.totalVideos = playlist.videos.length

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                playlistObject,
                "Playlist fetched successfully"
            )
        )
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    // TODO: remove video from playlist

})

const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    // TODO: delete playlist
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body
    //TODO: update playlist
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}