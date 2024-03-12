import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { Video } from "../models/video.model.js"
import {Tweet} from "../models/tweet.model.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params

    if(!videoId){
        throw new ApiError(400,"Video id is required")
    }

    try {
        const video = await Video.findById(videoId)
        if(!video){
            throw new ApiError(400,"video not found")
        }
        const likeCriteria = {video: videoId,likedBy: req.user?._id}
        const alreadyLiked = await Like.findOne(likeCriteria)
    
        if(!alreadyLiked){//add a like
            const newLike = await Like.create(likeCriteria)
            if(!newLike){
                throw new ApiError(500,"Unable to like the video ")
            }
            return res.status(200).json(
                new ApiResponse(200,newLike,"Successfully liked the video")
            )
        }
    
        //already liked 
        const dislike = await Like.deleteOne(likeCriteria)
        if(!dislike){
            throw new ApiError(500,"Unable to dislike the video")
        }
        return res.status(200).json(
            new ApiResponse(
                200,
                {},
                "Successfully disliked the video"
            )
        )
    } catch (error) {
        throw new ApiError(500,error?.message||"Unable to toggle the like of the video ")
    }
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    if(!commentId){
        throw new ApiError(400,"Comment Id is required")
    }

    try {
        const comment = await Comment.findById(commentId)
        if(!comment){
            throw new ApiError(400,"No comment found on this video")
        }
        const likeCriteria = {comment:commentId,likedBy: req.user?._id}
        const alreadyLiked = await Like.findOne(likeCriteria)
        if(!alreadyLiked){
            //create new like 
            const newLike = await Like.create(likeCriteria)
            if(!newLike){
                throw new ApiError(500,"Unable to like the comment ")
            }
            return res.status(200).json(
                new ApiResponse(
                    200,
                    newLike,
                    "successfully liked the comment"
                )
            )
        }

        //if liked already
        const dislike = await Like.deleteOne(likeCriteria)
        if(!dislike){
            throw new ApiError(500,"unable to dislike the comment")
        }
        
        return res.status(200).json(
            new ApiResponse(
                200,
                {},
                "comment disliked successfully "
            )
        )

    } catch (error) {
        throw new ApiError(500,error?.message||"Unable to toogle like in the comments")
    }

})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    if(!tweetId){
        throw new ApiError(400,"Tweet Id is required")
    }

    try {
        const tweet = await Tweet.findById(tweetId)
        if(!tweet){
            throw new ApiError(400,"No tweet found on this video")
        }
        const likeCriteria = {tweet:tweetId,likedBy: req.user?._id}
        const alreadyLiked = await Like.findOne(likeCriteria)
        if(!alreadyLiked){
            //create new like 
            const newLike = await Like.create(likeCriteria)
            if(!newLike){
                throw new ApiError(500,"Unable to like the tweet ")
            }
            return res.status(200).json(
                new ApiResponse(
                    200,
                    newLike,
                    "successfully liked the tweet"
                )
            )
        }

        //if liked already
        const dislike = await Like.deleteOne(likeCriteria)
        if(!dislike){
            throw new ApiError(500,"unable to dislike the tweet")
        }
        
        return res.status(200).json(
            new ApiResponse(
                200,
                {},
                "Successfully disliked the tweet"
            )
        )

    } catch (error) {
        throw new ApiError(500,error?.message||"Unable to toogle like in the Tweet")
    }
}
)

const getLikedVideos = asyncHandler(async (req, res) => {
    const userId = req.user?._id
    try {
        const likedVideos = await Like.aggregate([
            {
                $match: {
                    likedBy: new mongoose.Types.ObjectId(userId),
                }
            },
            {
                $lookup: {
                    from: "videos",
                    localField: "video",
                    foreignField: "_id",
                    as: "likedVideos"
                }
            },
            {
                $unwind: "$likedVideos"
            },
            {
                $match:{
                    "likedVideos.isPublished" : true
                }
            },
            {
                $lookup: {
                    from: "users",
                    let: { owner_id: "$likedVideos.owner" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$_id", "$$owner_id"] }
                            }
                        },
                        {
                            $project: {
                                _id: 0,
                                username: 1,
                                avatar: 1,
                                fullName: 1
                            }
                        }
                    ],
                    as: "owner"
                }
            },
            {
                $unwind: { path: "$owner", preserveNullAndEmptyArrays: true }
            },
            {
                $project: {
                    _id: "$likedVideos._id",
                    title: "$likedVideos.title",
                    thumbnail: "$likedVideos.thumbnail",
                    owner: {
                        username: "$owner.username",
                        avatar: "$owner.avatar",
                        fullName: "$owner.fullName"
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    likedVideos: { $push: "$$ROOT" }
                }
            },
            {
                $project: {
                    _id: 0,
                    likedVideos: 1
                }
            }
        ])
        if(likedVideos.length === 0 ){
            return res.status(200).json(
                new ApiResponse(
                    404,
                    [],
                    "No liked videos found"
                )
            )
        }
        return res.status(200).json(
            new ApiResponse(
                200,
                likedVideos,
                "Successfully fetched the Liked videos "
            )
        )
    } catch (error) {
        
    }
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}