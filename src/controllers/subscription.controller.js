import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"

import ApiError from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { Subscription } from "../models/subscription.models.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    // TODO: toggle subscription
    const userId = req.user?._id
    if(!channelId|| !userId){
        throw new ApiError(400,"UserID and channel id both are required")
    }

    const credential = {subscriber: userId,channel : channelId}
    try {
        const subscribed = await Subscription.findOne(credential)
        if(!subscribed){
            const newSubscription = await Subscription.create(credential)
            if(!newSubscription){
                throw new ApiError(500,"unable to subscribe the channel")
            }

            return res.status(200).json(
                new ApiResponse(
                    200,
                    newSubscription,
                    "Channel subscribed successfully"
                )
            )
        }else{
            const deleteSubscription = await Subscription.deleteOne(credential)
            if(!deleteSubscription){
                throw new ApiError(500,"unable to unsubscribe the channel ")
            }

            return res.status(200).json(
                new ApiResponse(
                    200,
                    deleteSubscription,
                    "Channel unsubscribed successfully"
                )
            )
        }
    } catch (error) {
        throw new ApiError(500,error?.message||"Unable to toogel subscription")
    }
})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const {subscriberId} = req.params
    if(!subscriberId){
        throw new ApiError(400,"Subscriber ID is required")
    }

    try {
        const subscribers = await Subscription.aggregate([
            {
                $match:{
                    channel : new mongoose.Types.ObjectId(subscriberId)
                } 
            },
            {
                $group: {
                    _id: "channel",
                    subscribers: {
                        $push: "$subscriber"
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    subscribers: 1
                }
            }
        ])
        if(!subscribers||subscribers.length === 0) {
            return res.status(200).json(
                new ApiResponse(
                    200,
                    [],
                    "No subscriber found for the channel "
                )
            )
        }

        return res.status(200).json(
            new ApiResponse(
                200,
                subscribers,
                "All subscribers fetched successfully"
            )
        )

    } catch (error) {
        throw new ApiError(500,error?.message||"Unable to fetch subscribers")
    }
    
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { channelId } = req.params
    if(!channelId){
        throw new ApiError(400,"channel id is required")
    }

    try {
        const subscribedchannels = await Subscription.aggregate([
            {
                $match:{
                    subscriber: new mongoose.Types.ObjectId(channelId)
                }
            },
            {
                $group: {
                    _id:"subscriber",
                    subscribedchannels: {$push: "$channel"}
                }
            },
            {
                $project:{
                    _id:0,
                    subscribedchannels: 1
                }
            }
        ])
        if(!subscribedchannels||subscribedchannels.length===0){
            return res.staus(200).json(
                new ApiResponse(
                    200,
                    [],
                    "No subscribed channel found for the user"
                )
            )
        }
        return res.status(200).json(
            new ApiResponse(
                200,
                subscribedchannels,
                "All subscribed channels fetched successfully "
            )
        )
    } catch (error) {
        throw new ApiError(500,error?.message||"unable to fetch channels ")
    }
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}