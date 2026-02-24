import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

let isConfigured = false;

const configureCloudinary = () => {
  if (isConfigured) return;

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  isConfigured = true;
};

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null

        configureCloudinary()   // config happens AFTER dotenv

        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        // console.log("File is uploaded on cloudinary", response.url)
        fs.unlinkSync(localFilePath)
        return response
    } catch (error) {
        fs.unlinkSync(localFilePath)
        return null
    }
}

const deleteFromCloudinary = async (fileId, resourceType = "image") => {
    try {
        if(!fileId) return null

        configureCloudinary()

        const response = await cloudinary.uploader.destroy(fileId, {
            resource_type: resourceType,
            invalidate: true
        })
        return response
    } catch (error) {
        console.error("Cloudinary deletion error: ", error)
        return null
    }
}

export {uploadOnCloudinary, deleteFromCloudinary}