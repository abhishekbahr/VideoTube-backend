import mongoose, {isValidObjectId} from "mongoose"
import {Playlist} from "../models/playlist.model.js"
import {User} from "../models/user.models.js"
import {Video} from '../models/video.model.js'
import ApiError from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const isUserOwnerofPlaylist = async(playlistId,userId) => {
    try {
        const playlist = await Playlist.findById(playlistId)
        if(!playlist){
            throw new ApiError(400,"playlist doesn't exist")
        }
        if(playlist?.owner.toString()!==userId.toString()){
            return false
        }
        return true
    } catch (error) {
        throw new ApiError(400,error?.message||"Playlist not found")
    }
}

const createPlaylist = asyncHandler(async (req, res) => {
    const {name, description} = req.body
    if(!name){
        throw new ApiError(400,"name is required to create the playlist ")
    }
    let playlistDescription = description || " "

    try {
        
        const playlist = await Playlist.create({
            name,
            description: playlistDescription,
            owner: req.user?._id,
            videos: []
        })
        if(!playlist){
            throw new ApiError(500,"Unable to create the playlist ")
        }

        return res.status(200).json(
            new ApiResponse(
                200,
                playlist,
                "Playlist created successfully"
            )
        )

    } catch (error) {
        throw new ApiError(500,error?.message|| "Something went wrong while creating the playlist")
        
    }



})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const {userId} = req.params
    if(!userId){
        throw new ApiError(400,"userId is required")
    }

    try {
        const user = await User.findById(userId)
        if(!user){
            throw new ApiError(404,"User not found")
        }

        const playlist = await Playlist.aggregate([
            {
                $match: {
                    owner: user?._id
                }
            },
            {
                $project:{
                    _id:1,
                    name: 1,
                    description: 1,
                    owner: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    videos:{
                        $cond:{
                            if:{$eq:["$owner",new mongoose.Types.ObjectId(req?.user?._id)]},
                            then:"$videos",
                            else:{
                                $filter:{
                                    input: "$videos",
                                    as : "video",
                                    cond: {
                                        $eq:["$video.isPublished", true]
                                    }
                                }
                            }
                        }
                    }
                }
            }
        ])
        if(!playlist){
            throw new ApiError(404,"There is no playlist made by this user")
        }
        return res.status(200).json(
            new ApiResponse(
                200,
                playlist,
                "Playlist fetched successfully " 
            )
        )
    } catch (error) {
        throw new ApiError(500,error?.message||"Unable to fetch the playlist or playlist doesn't exists")
    }
})

const getPlaylistById = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    if(!playlistId){
        throw new ApiError(400,"Playlist id is required")
    }

    try {
        
        const playlist = await Playlist.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(playlistId)
                }
            },
            {
                $project: {
                    _id:1,
                    name: 1,
                    description: 1,
                    owner:1,
                    createdAt:1,
                    updatedAt:1,
                    videos:{
                        $cond:{
                            if:{
                                $eq:["$owner",new mongoose.Types.ObjectId(req?.user?._id)]
                            },
                            then: "$videos",
                            else:{
                                $filter:{
                                    input: "$videos",
                                    as: "video",
                                    cond: {
                                        $eq:["$video.isPublished",true]
                                    }
                                }
                            }
                        }
                    }
                }
            }
        ])

        if(!playlist){
            throw new ApiError(400,"playlist not found")
        }
        return res.status(200).json(
            new ApiResponse(
                200,
                playlist,
                "Playlist fetched successfully found "
            )
        )

    } catch (error) {
        throw new ApiError(500,error?.message||"Unable to find the playlist ")
    }

})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    if(!playlistId||!videoId){
        throw new ApiError(400,"Playlist id and video id is required")
    }
    try {
        const userOwner = await isUserOwnerofPlaylist(playlistId,req?.user?._id)
        if(!userOwner){
            throw new ApiError(300,"Unauthorized access")
        }

        const video = await Video.findById(videoId)
        if(!video||(!(video.owner.toString()===req.user?._id.toString())&&!video?.isPublished)){
            throw new ApiError(404,"Video not found")
        }

        //check if video is already in playlist or not 
        const playlist = await Playlist.findById(playlistId)
        if(playlist.videos.includes(videoId)){
            return res.status(200).json(
                new ApiResponse(
                    200,
                    {},
                    "Video is already present in the playlist"
                )
            )
        }

        const addedPlaylist = await Playlist.updateOne({
            _id: new mongoose.Types.ObjectId(playlistId)
        },{
            $push:{videos:videoId}
        })
        if(!addedPlaylist){
            throw new ApiError(500,"Unable to add the video to the playlist ")
        }

        return res.status(200).json(
            new ApiResponse(
                200,
                addedPlaylist,
                "video successfully added to playlist "
            )
        )
    } catch (error) {
        throw new ApiError(500,error?.message||"Unable to add video to the playlist ")
    }


})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    if(!playlistId||!videoId){
        throw new ApiError(400,"Playlist id and video id is required")
    }

    try {
        const userOwner = await isUserOwnerofPlaylist(playlistId,req?.user?._id)
        if(!userOwner){
            throw new ApiError(400,"Unauthorized accesS")
        }

        const video = await Video.findById(videoId)
        if(!video){
            throw new ApiError(404,"Video not found")
        }

        const playlist = await Playlist.findById(playlistId)
        if(!playlist.videos.includes(videoId)){
            throw new ApiError(404,"No video found in the playlist ")
        }

        if(!video?.isPublished){
            const removeVideoFromPlaylist = await Playlist.updateOne({
                _id:new mongoose.Types.ObjectId(playlistId)
            },{
                $pull: {video: videoId}
            })
            if(!removeVideoFromPlaylist){
                throw new ApiError(500,"Unable to remove, Retry!!!")
            }
            
            return res.status(200).json(
                new ApiResponse(
                    200,
                    {},
                    "video not found in the playlist "
                )
            )
        }

        const removeVideoFromPlaylist = await Playlist.updateOne({
            _id: new mongoose.Types.ObjectId(playlistId)
        },{
            $pull:{videos: videoId}
        })
        if(!removeVideoFromPlaylist){
            throw new ApiError(500,"Unable to remove the video from the playlist ")
        }
        return res.status(200).json(
            new ApiResponse(
                200,
                removeVideoFromPlaylist,
                "Video successfully removed from the playlist"
            )
        )

    } catch (error) {
        throw new ApiError(500,error?.message||"Unable to remove the video from playlist")
    }
})

const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    if(!playlistId){
        throw new ApiError(400,"playlist id is required")
    }

    try {
        const userOwner = await isUserOwnerofPlaylist(playlistId,req?.user?._id)
        if(!userOwner){
            throw new ApiError(300,"Unauthorized Access")
        }

        const playlist = await Playlist.findByIdAndDelete(playlistId)
        if(!playlist){
            throw new ApiError(400,"Unable to delete the playlist ")
        }
        return res.status(200).json(
            new ApiResponse(
                200,
                {},
                "Playlist deleted successfully"
            )
        )
    } catch (error) {
        throw new ApiError(500,error?.message||"Playlist is not correct ")
    }
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body
    
    if(!playlistId){
        throw new ApiError(400,"playlist id is required")
    }

    try {
        const userOwner =await isUserOwnerofPlaylist(playlistId,req.user?._id)
        if(!userOwner){
            throw new ApiError(300,"Unauthorized access")
        }
        if(!name||!description){
            throw new ApiError(404,"Name and description both are required")
        }

        const updatePlaylist = await Playlist.findByIdAndUpdate(playlistId,{
            $set:{
                name,
                description
            }
        })
        if(!updatePlaylist){
            throw new ApiError(500,"Unable to update the playlist")
        }
        return res.status(200).json(
            new ApiResponse(
                200,
                updatePlaylist,
                "Successfully updated the playlist "
            )
        )
    } catch (error) {
        throw new ApiError(500,error?.message||"Playlist is not correct")
    }
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