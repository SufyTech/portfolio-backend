import express from "express";
import { sendResumeRequest } from "../controllers/resumeController.js";

const router = express.Router();

// POST route to handle resume requests
router.post("/request-resume", sendResumeRequest);

export default router;
