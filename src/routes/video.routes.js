import {Router} from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { deleteVideo, getAllVideos, getVideoById, publishAVideo, togglePublishStatus, updateVideo } from '../controllers/video.controller.js';
import { upload } from '../middlewares/multer.middleware.js';



const router = Router();

router.use(verifyJWT)  // Apply the verifyJWT middleware to all routes defined in this router. This means that any request to these routes must include a valid JWT token for authentication.

router
    .route("/")
    .get(getAllVideos)
    .post(
        upload.fields([
            {
                name: "videoFile",
                maxCount: 1,
            },
            {
                name: "thumbnail",
                maxCount: 1,
            }
        ]),
        publishAVideo
    )

router.route("/:videoId")
    .get(getVideoById)
    .patch(upload.single("thumbnail"), updateVideo)
    .delete(deleteVideo)

router.route("/toggle/publish/:videoId").patch(togglePublishStatus)






export default router;