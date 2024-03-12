import mongoose, { Mongoose } from "mongoose"
import { asyncHandler } from "../utils/asyncHandler.js"
import ApiError from "../utils/ApiError.js"
import {Video} from "../models/video.model.js"
import { Comment } from "../models/comment.model.js"
import { ApiResponse } from "../utils/ApiResponse.js"

const getVideoComments = asyncHandler(async(req,res) => {
    const {videoId} =req.params
    const {page=1,limit=10} = req.query

    if(!videoId){
        throw new ApiError(400, "Video ID is required")
    }

    const video = await Video.findById(videoId)
    if(!video){
        await Comment.deleteMany({video: videoId})
        throw new ApiError(400,"there is no such video")
    }

    const comments = await Comment.aggregate([
        {
            $match:{
                video: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $skip: (Number(page)-1)*limit
        },
        {
            $limit: Number(limit)
        },
        {
            $lookup:{
                from: "users",
                localField: "owner",
                foreignField: "_id",
                pipeline:[
                    {
                        $project:{
                            username:1,
                            fullname: 1,
                            avatar:1
                        }
                    }
                ],
                as: "owner"
            }
        }
    ])

    if(!comments||comments.length === 0) {
        return res.status(200).json(new ApiResponse(
            200,{},"No comments in the video"
        ))
    }

    return res.status(200).json(
        new ApiResponse(200,comments,"Comments of trhe video fetched successfully")
    )
})

const addComments = asyncHandler(async(req,res) => {
    const {videoId} = req.params
    const {commentContent} = req.body

    if(!videoId){
        throw new ApiError(400,"videoID is required to add comments ")
    }
    try {
        const video = await Video.findById(videoId)
        if(!video){
            throw new ApiError(400,"There is no such video")
        }

        const comment = await Comment.create({
            comment: commentContent,
            video: videoId,
            owner: req.user?._id
        })
        if(!comment){
            throw new ApiError(500,"unable to create comment")
        }

        return res.status(200).json(
            new ApiResponse(200,comment,"Comment posted Successfully")
        )

    } catch (error) {
        throw new ApiError(500,error?.message||"Unable to create comment")
    }

})
const deleteComment = asyncHandler(async(req,res) => {
    const {commentId} = req.params

    if(!commentId){
        throw new ApiError(400,"comment id is required")
    }

    try {
        const videoId = new mongoose.Types.ObjectId(comment.video)
        const video = await Video.findById(videoId)
        if(!video){
            await Comment.deleteMany({video: videoId})
            throw new ApiError(400,"there is no such video. All associated comment have been deleted")
        }
        if(video.owner.toString() !== req.user?._id.toString() && !video.isPublished){
            throw new ApiError(300,"Video doesnt exists")
        }
        if(comment.owner.toString() !== req.user?._id.toString()){
            throw new ApiError(300,"Unauthorized access")
        }
    
        const deleteComment = await Comment.findByIdAndDelete(commentId)
        if(!deleteComment){
            throw new ApiError(500,"Unable to delete the comment")
        }
        return res.status(200).json(
            new ApiResponse(
                200,{},"Comment deleted successfully"
            )
        )
    } catch (error) {
        throw new ApiError(500,error?.message||"Unable to delete the commment")
    }
})

const updateComment = asyncHandler(async (req,res) => {
    const {commentId} =req.params
    const {commentContent} = req.body
    if(!commentId){
        throw new ApiError(400,"comment id is required")
    }
        
    if(!commentContent){
        throw new ApiError(400,"new comment  is required to update the comment ")
    }

    try {
        const comment = await Comment.findById(commentId)
        if(!comment){
            throw new ApiError(400,"comment do not exists")
        }
        const videoId = new mongoose.Types.ObjectId(comment.video)
        const video = await Video.findById(videoId)
        if(!video){
            await Comment.deleteMany({video:videoId})
            return res.status(404).json(
                new ApiResponse(404,{},"Comment doesnot exists")
            )
        }

        if(video.owner.toString() !== req.user?._id.toString() && !video.isPublished){
            throw new ApiError(300,"Video doesnt exists")
        }
        if(comment.owner.toString() !== req.user?._id.toString()){
            throw new ApiError(300,"Unauthorized access")
        }

        const updateComment = await Comment.findByIdAndUpdate(
            commentId,
            {
                $set:{
                    comment: commentContent
                }
            },
            {
                new :true
            }
        )

        if(!updateComment){
            throw new ApiError(500,"Unable to update the comment")
        }

        return res.status(200).json(
            new ApiResponse(
                200,
                updateComment,
                "Comment updated successfully"
            )
        )
    } catch (error) {
        throw new ApiError(500,error?.message||"unable to update the comment")
    }

})
export {
    getVideoComments,
    addComments,
    updateComment,
    deleteComment
}