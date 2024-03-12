import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Tweet } from "../models/tweet.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.models.js";
import mongoose from "mongoose";


const createTweet = asyncHandler(async(req,res) => {
    const {content} = req.body

    if(!content){
        throw new ApiError(400,"Content is requied to tweet ")
    }

    try {
        const tweet = await Tweet.create({
            content
        })
    
        if(!tweet){
            throw new ApiError(401,"Unable to create tweet")
        }
    
        return res.status(200).json(
            new ApiResponse(200,tweet,"Succesfully published the tweet")
        )
    } catch (error) {
        throw new ApiError(500,error?.message||"Unable to create the tweet")
    }

})

const getUserTweets = asyncHandler(async(req,res) => {
    const {userId} = req.params
    if(!userId){
        throw new ApiError(400,"User is is required")
    }

    try {
        const tweet = await Tweet.aggregate([
            {
                $match:{
                    owner: new mongoose.Types.ObjectId(userId)
                }
            },
            {
                $group:{
                    _id: "owner",
                    tweets: {$push: "$content"}
                }
            },
            {
                $project:{
                    _id:0,
                    tweets:1
                }
            }
        ])
        if(!tweet||tweet.length === 0){
            return res.status(200).json(
                new ApiResponse(200,[],"User have no tweets")
            )
        }
        
        return res.status(200).json(
            new ApiResponse(200,tweet,"Tweet for the user fetched succesfully")
        )
    } catch (error) {
        throw new ApiError(500,error?.message||"Unable to fetch the tweet of the uesr!")
    }
})

const updateTweet = asyncHandler(async(req,res) => {
    const {tweetId} = req.params
    const {tweetContent} = req.body

    if(!tweetId){
        throw new ApiError(400,"tweetID is required to update the tweet")
    }
    if(!tweetContent){
        throw new ApiError(400,"tweetContent is required to update the tweet")
    }
    const existingTweet = await Tweet.findById(tweetId)

    //for checking user is owner or not 
    if(existingTweet.owner.toString()!==req.user?._id.toString()){
        throw new ApiError(300,"Unauthorized Access")
    }

    try {
        const updatedTweet = await Tweet.findByIdAndUpdate(tweetId,{
            $set:{
                content: tweetContent
            }
        },{
            new:true
        })
    
        if(!updatedTweet){
            throw new ApiError(401,"unable to update the tweet")
        }
        return res.status(200).json(
            new ApiResponse(200,updatedTweet,"Successfully updated the tweet")
        )
    } catch (error) {
        throw new ApiError(500,error?.message||"There was a problem while updating the tweet")
    }

})

const deleteTweet = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    if(!tweetId){
        throw new ApiError(400,"Tweet Id is required to delete the tweet")
    }

    try {
        const tweet = await Tweet.findByIdAndDelete(tweetId)
        if(!tweet){
            throw new ApiError(500,"Unable to delete tweet")
        }
        
        return res.status(200).json(
            200,
            {},
            "Tweet Deleted successfully"
        )
    } catch (error) {
        throw new ApiError(500,error?.message||"Problem while deleting the tweet ")
    }
})


export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}