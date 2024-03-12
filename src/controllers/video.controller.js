import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import ApiError from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { upload } from "../middlewares/multer.middleware.js"
import { Comment } from "../models/comment.model.js"
import { Like} from "../models/like.model.js"
import { Playlist } from "../models/playlist.model.js"


const isUserOwner = async (videoId,req) => {
    const video = await Video.findById(videoId)
    if(video?.owner.toString() !== req.user?._id.toString()){
        return false
    }
    return true
}

const getAllVideos = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 10, 
        query, 
        sortBy, 
        sortType, 
        userId 
    } = req.query
    
    // Parse page and limit to numbers
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    // Validate and adjust page and limit values
    page = Math.max(1, page); // Ensure page is at least 1
    limit = Math.min(20, Math.max(1, limit)); // Ensure limit is between 1 and 20

    const pipeline = []

    //match video by owner id if provided
    if(userId){
        if(!isValidObjectId){
            throw new ApiError(400,"UserId is invalid")
        }

        pipeline.push({
            $match:{
                owner: mongoose.Types.ObjectId(userId)
            }
        })
    }

    //match video based on search query 
    if(query){
        pipeline.push({
            $match:{
                $text:{
                    $search: query
                }
            }
        })
    }
    //sort the pipeline stage based on sortBy and sortType

    const sortCriteria = {}
    if(sortBy&&sortType){
        sortCriteria[sortBy] = sortType === 'asc' ? 1 : -1
        pipeline.push({
            $sort: sortCriteria
        })
    }else {
        // Default sorting by createdAt if sortBy and sortType are not provided
        sortCriteria["createdAt"] = -1;
        pipeline.push({
            $sort: sortCriteria
        });
    }

    //apply pagination using skip and limit
    pipeline.push({
        $skip: (page -1)*limit 
    })
    pipeline.push({
        $limit: limit
    })

    const Videos = await Video.aggregate(pipeline)
    if(!Videos||Videos.length === 0){
        throw new ApiError(404,"Videos not found")
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            Videos,
            "videos fetched successfully"
        )
    )

})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body
    
    if(!title||!description){
        throw new ApiError(400,"Title and description both are required")
    }

    const videoLocalPath = req.files?.videoFile[0]?.path
    const thumbnailLocalPath = req.files?.thumbnail[0]?.path

    if(!videoLocalPath){
        throw new ApiError(404,"Video is required")
    }
    if(!thumbnailLocalPath){
        throw new ApiError(404,"Thumbnail is required")
    }

    const video = await uploadOnCloudinary(videoLocalPath)
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)

    if(!video?.url){
        throw new ApiError(500,"Something went wrong while uploading the video ")
    }
    if(!thumbnail?.url){
        throw new ApiError(500,"Something went wrong while uploading the thumbnail ")
    }

    const newVideo = await Video.create({
        videoFile : video?.url,
        thumbnail: thumbnail?.url,
        title,
        description,
        duration : video?.duration,
        isPublished: true,
        owner : req.user?._id
    })

    return res.status(200).json(
        new ApiResponse(
            200, 
            newVideo,
            "Video published successfully"
        )
    )

})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if(!videoId){
        throw new ApiError(400,"Video id is required")
    }
    
    const video = await Video.findById(videoId)
    if(!video || (!video?.isPublished && !(video?.owner.toString() === req.user?._id.toString()))){
        throw new ApiError(404,"video not found")
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            video,
            "Video fetched successfullY"
        )
    )
    
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if(!videoId){
        throw new ApiError(400,"Video id is required")
    }

    const video = await Video.findById(videoId)
    if(!video){
        throw new ApiError(404,"Video Doesnt exists")
    }

    const authorized = await isUserOwner(videoId,req)
    if(!authorized){
        throw new ApiError(300,"Unauthorized Access ")
    }

    const {title,description} = req.body

    if(!title || !description){
        throw new ApiError(404,"Title or description is required")
    }

    const thumbnailLocalPath = req.files?.path
    if(!thumbnailLocalPath){
        throw new ApiError(400,'thumbnail is required')
    }

    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)
    if(!thumbnail.url){
        throw new ApiError(400,"Something went wrong while updating the thumbnail")
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title,
                description,
                thumbnail: thumbnail?.url
            }
        },
        {
            new :true
        }
    )
    if(!updatedVideo){
        throw new ApiError(500,"Something went wrong while updating")
    }
    return res.status(200).json(
        new ApiResponse(
            200,
            updatedVideo,
            "Video update successfully"
        )
    )
})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if(!videoId){
        throw new ApiError(400,"Video id is required")
    }

    const video = await Video.findById(videoId)
    if(!video){
        throw new ApiError(400,"Video doesnt exists")
    }

    const authorized = await isUserOwner(videoId,req)
    if(!authorized){
        throw new ApiError(400, "unauthorized access")
    }

    const videoDeleted = await Video.findByIdAndDelete(videoId)
    if(!videoDeleted){
        throw new ApiError(500,"Something went wrong while deleting the video")
    }

    //delete respective comments and like of the video  and remove video id from any playlist if someone has it
    await Comment.deleteMany({video: videoId})
    await Like.deleteMany({video: videoId})

    const playlists = await Playlist.find({videos: videoId})
    for(const playlist of playlists){
        await Playlist.findByIdAndUpdate(
            playlist._id,
            {
                $pull: {video: videoId}
            },
            {
                new :true
            }
        )
    }
    return res.status(200).json(
        200,
        {},
        "Video Deleted successfully"
    )


})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if(!videoId){
        throw new ApiError(400,"Video id is required")
    }
    
    const video = await Video.findById(videoId)
    if(!video){
        throw new ApiError(400,"Video doesnt exists")
    }

    const authorized = await isUserOwner(videoId,req)
    if(!authorized){
        throw new ApiError(300, "Unauthorized acces ")
    }

    const updateVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                isPublished: !video.isPublished
            }
        },
        {
            new: true
        }
    )
    if(!updateVideo){
        throw new ApiError(500,"Something went wrong while toggling the status")
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            updateVideo,
            "Publish status of the video is toggled successfully "
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