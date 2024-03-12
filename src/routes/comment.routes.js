import {Router} from "express"
import {
    getVideoComments,
    addComments,
    deleteComment,
    updateComment
} from "../controllers/comment.controller.js"


const router = Router()

import { verifyJWT } from "../middlewares/auth.middleware.js"
router.use(verifyJWT)

router.route("/:videoId").get(getVideoComments).post(addComments)
router.route("/c/:commentId").delete(deleteComment).patch(updateComment)


export default router