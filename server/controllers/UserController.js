import Student from "../models/Student.js";
import Config from "../models/Config.js";

/**
 * @desc    Register a new student application
 * @route   POST /api/students/register (or /api/users/register)
 * @access  Public
 */
export const registerUser = async (req, res) => {
  try {
    // 0. Check global recruitment open status and registration deadline
    try {
      const config = await Config.findOne({ key: "recruitment_config" });
      if (!config) {
        return res.status(503).json({
          success: false,
          recruitmentOpenStatus: false,
          message: "Recruitment configuration unavailable. Applications are currently closed.",
          error: "Recruitment config not found.",
        });
      }

      const isPastDeadline = config.registrationCloseDate ? (Date.now() > new Date(config.registrationCloseDate).getTime()) : false;
      if (config.recruitmentOpenStatus === false || isPastDeadline) {
        const dateStr = config.registrationCloseDate 
          ? new Date(config.registrationCloseDate).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'long', day: 'numeric', year: 'numeric' })
          : null;

        return res.status(403).json({
          success: false,
          recruitmentOpenStatus: false,
          message: isPastDeadline
            ? "Recruitment applications are officially closed. The registration period has ended."
            : "Recruitment applications are currently closed. Stay tuned for joining the crew!",
          error: "Recruitment is currently closed.",
        });
      }

      // Check if candidate is applying for a role that is specifically closed (e.g. Backend Developer)
      const closedRoles = Array.isArray(config.closedRoles) ? config.closedRoles : ['Backend Developer'];
      const targetSubRole = (req.body.subRole || '').trim();
      if (closedRoles.includes(targetSubRole)) {
        return res.status(403).json({
          success: false,
          roleClosed: true,
          message: `Applications for the ${targetSubRole} role are officially closed. Please choose another role.`,
          error: "Selected role is closed.",
        });
      }
    } catch (configErr) {
      console.error("Could not query recruitment config, refusing registration for safety:", configErr.message);
      return res.status(503).json({
        success: false,
        recruitmentOpenStatus: false,
        message: "Database connection unavailable. Applications are temporarily closed.",
        error: "Database disconnected.",
      });
    }

    const {
      personalEmail,
      email,
      collegeEmail,
      Name,
      department,
      year,
      section,
      mobileNumber,
      regNumber,
      role,
      subRole,
      githubUrl,
      linkedinUrl,
    } = req.body;

    // 1. Basic validation for required fields
    if (
      !Name ||
      !department ||
      !year ||
      !section ||
      !mobileNumber ||
      !personalEmail ||
      !role ||
      !subRole
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, Mobile Number, Personal Email, Department, Section, Track, and Role are required.",
      });
    }

    const cleanMobile = mobileNumber.trim();
    const cleanPersonalEmail = personalEmail && typeof personalEmail === 'string' && personalEmail.trim() ? personalEmail.toLowerCase().trim() : null;
    const rawCollegeEmail = email || collegeEmail;
    const cleanCollegeEmail = rawCollegeEmail && typeof rawCollegeEmail === 'string' && rawCollegeEmail.trim() ? rawCollegeEmail.toLowerCase().trim() : null;
    const cleanRegNumber = regNumber && typeof regNumber === 'string' ? regNumber.trim().toUpperCase() : "";

    // Validate personal email must end with @gmail.com
    if (!cleanPersonalEmail || !cleanPersonalEmail.endsWith('@gmail.com')) {
      return res.status(400).json({
        success: false,
        message: "Personal email must be a valid @gmail.com address.",
      });
    }

    // Validate university email if provided
    if (cleanCollegeEmail && !cleanCollegeEmail.endsWith('@citchennai.net')) {
      return res.status(400).json({
        success: false,
        message: "Only official @citchennai.net university accounts are permitted.",
      });
    }

    // Validate LinkedIn URL / handle format if provided
    let cleanLinkedinUrl = "";
    let cleanLinkedinSlug = "";
    if (linkedinUrl && typeof linkedinUrl === "string" && linkedinUrl.trim()) {
      const rawSlug = linkedinUrl
        .trim()
        .replace(/^https?:\/\/(www\.)?linkedin\.com\/(in\/)?/i, "")
        .replace(/^in\//i, "")
        .replace(/^\/+|\/+$/g, "")
        .trim();

      const isValidSlug =
        rawSlug.length >= 3 &&
        rawSlug.length <= 100 &&
        /^[a-zA-Z0-9-]{3,100}$/.test(rawSlug) &&
        !rawSlug.startsWith("-") &&
        !rawSlug.endsWith("-") &&
        !rawSlug.includes("--");

      if (!isValidSlug) {
        return res.status(400).json({
          success: false,
          message: "Validation Error",
          error: "Invalid LinkedIn profile handle format. Must be 3–100 characters containing only letters, numbers, and hyphens.",
        });
      }
      cleanLinkedinSlug = rawSlug;
      cleanLinkedinUrl = `https://www.linkedin.com/in/${rawSlug}/`;
    }

    // Extract GitHub username if provided
    let cleanGithubSlug = "";
    if (githubUrl && typeof githubUrl === "string" && githubUrl.trim()) {
      cleanGithubSlug = githubUrl
        .trim()
        .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
        .replace(/\/+$/, "")
        .trim();
    }

    // 2. Check if student already registered with mobile number, personal email, university email, GitHub, or LinkedIn
    const duplicateQueries = [{ mobileNumber: cleanMobile }, { personalEmail: cleanPersonalEmail }];
    if (cleanCollegeEmail) {
      duplicateQueries.push({ email: cleanCollegeEmail });
    }

    let ghRegex = null;
    if (cleanGithubSlug) {
      const escapedGh = cleanGithubSlug.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      ghRegex = new RegExp(`^(https?:\\/\\/(www\.)?github\\.com\\/)?${escapedGh}\\/?$`, 'i');
      duplicateQueries.push({ githubUrl: ghRegex });
    }

    let liRegex = null;
    if (cleanLinkedinSlug) {
      const escapedLi = cleanLinkedinSlug.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      liRegex = new RegExp(`(linkedin\\.com\\/in\\/|^in\\/)?${escapedLi}\\/?$`, 'i');
      duplicateQueries.push({ linkedinUrl: liRegex });
    }

    const existingStudent = await Student.findOne({
      $or: duplicateQueries,
    });

    if (existingStudent) {
      let duplicateField = "Mobile number";
      if (existingStudent.personalEmail === cleanPersonalEmail) {
        duplicateField = "Personal email address";
      } else if (cleanCollegeEmail && existingStudent.email === cleanCollegeEmail) {
        duplicateField = "University email address";
      } else if (existingStudent.mobileNumber === cleanMobile) {
        duplicateField = "Mobile number";
      } else if (cleanGithubSlug && existingStudent.githubUrl && ghRegex && ghRegex.test(existingStudent.githubUrl)) {
        duplicateField = "GitHub username";
      } else if (cleanLinkedinSlug && existingStudent.linkedinUrl && liRegex && liRegex.test(existingStudent.linkedinUrl)) {
        duplicateField = "LinkedIn profile";
      }

      return res.status(409).json({
        success: false,
        message: "Already registered",
        error: `A student with this ${duplicateField} has already registered.`,
      });
    }

    // 3. Create and store the new student record in Database
    const studentData = {
      Name: Name.trim(),
      department: department.trim(),
      year: (year || "1st Year").trim(),
      section: section.trim().toUpperCase(),
      mobileNumber: cleanMobile,
      personalEmail: cleanPersonalEmail,
      regNumber: cleanRegNumber,
      role,
      subRole,
      githubUrl: githubUrl ? githubUrl.trim() : "",
      linkedinUrl: cleanLinkedinUrl,
    };

    if (cleanCollegeEmail) {
      studentData.email = cleanCollegeEmail;
    }

    const newStudent = new Student(studentData);
    const savedStudent = await newStudent.save();

    // 4. Send success response
    return res.status(201).json({
      success: true,
      message: "Response successfully received",
      data: savedStudent,
    });
  } catch (error) {
    console.error("Error registering student:", error);

    // Handle Mongoose validation errors gracefully
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: messages,
      });
    }

    // Handle MongoDB duplicate key error (code 11000)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || "field";
      const fieldLabels = {
        mobileNumber: "Mobile number",
        personalEmail: "Personal email",
        email: "University email",
        githubUrl: "GitHub username",
        linkedinUrl: "LinkedIn profile",
      };
      const label = fieldLabels[field] || field;

      return res.status(409).json({
        success: false,
        message: "Duplicate entry",
        error: `A student with this ${label} is already registered.`,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error. Could not register.",
      error: error.message,
    });
  }
};

/**
 * @desc    Check if a student is already registered by email, personalEmail, regNumber, mobile, github, or linkedin
 * @route   POST /api/students/check
 * @access  Public
 */
export const checkStudentExists = async (req, res) => {
  try {
    const {
      email,
      personalEmail,
      collegeEmail,
      regNumber,
      mobileNumber,
      githubUsername,
      linkedinUsername,
      githubUrl,
      linkedinUrl
    } = req.body;

    const queries = [];
    const cleanPersonal = personalEmail && typeof personalEmail === 'string' && personalEmail.trim() ? personalEmail.toLowerCase().trim() : null;
    const cleanCollege = (collegeEmail || email) && typeof (collegeEmail || email) === 'string' && (collegeEmail || email).trim() ? (collegeEmail || email).toLowerCase().trim() : null;

    if (mobileNumber && mobileNumber.trim()) queries.push({ mobileNumber: mobileNumber.trim() });
    if (cleanPersonal) queries.push({ personalEmail: cleanPersonal });
    if (cleanCollege) queries.push({ email: cleanCollege });
    if (regNumber && regNumber.trim()) queries.push({ regNumber: regNumber.toUpperCase().trim() });

    // GitHub username / URL duplicate check
    let cleanGithubSlug = null;
    let ghRegex = null;
    const rawGithub = githubUsername || githubUrl;
    if (rawGithub && typeof rawGithub === 'string' && rawGithub.trim()) {
      cleanGithubSlug = rawGithub.replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/\/+$/, '').trim();
      if (cleanGithubSlug) {
        const escapedGh = cleanGithubSlug.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        ghRegex = new RegExp(`^(https?:\\/\\/(www\.)?github\\.com\\/)?${escapedGh}\\/?$`, 'i');
        queries.push({ githubUrl: ghRegex });
      }
    }

    // LinkedIn username / URL duplicate check
    let cleanLinkedinSlug = null;
    let liRegex = null;
    const rawLinkedin = linkedinUsername || linkedinUrl;
    if (rawLinkedin && typeof rawLinkedin === 'string' && rawLinkedin.trim()) {
      cleanLinkedinSlug = rawLinkedin
        .replace(/^https?:\/\/(www\.)?linkedin\.com\/(in\/)?/i, '')
        .replace(/^in\//i, '')
        .replace(/^\/+|\/+$/g, '')
        .trim();
      if (cleanLinkedinSlug) {
        const escapedLi = cleanLinkedinSlug.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        liRegex = new RegExp(`(linkedin\\.com\\/in\\/|^in\\/)?${escapedLi}\\/?$`, 'i');
        queries.push({ linkedinUrl: liRegex });
      }
    }

    if (queries.length === 0) {
      return res.status(200).json({
        success: true,
        exists: false,
        message: "No identifiers provided to check.",
      });
    }

    const existingStudent = await Student.findOne({ $or: queries });

    if (existingStudent) {
      let duplicateField = "Mobile number";
      if (cleanPersonal && existingStudent.personalEmail === cleanPersonal) {
        duplicateField = "Personal email address";
      } else if (cleanCollege && existingStudent.email === cleanCollege) {
        duplicateField = "University email address";
      } else if (mobileNumber && existingStudent.mobileNumber === mobileNumber.trim()) {
        duplicateField = "Mobile number";
      } else if (regNumber && existingStudent.regNumber === regNumber.toUpperCase().trim()) {
        duplicateField = "Register number";
      } else if (cleanGithubSlug && existingStudent.githubUrl && ghRegex && ghRegex.test(existingStudent.githubUrl)) {
        duplicateField = "GitHub username";
      } else if (cleanLinkedinSlug && existingStudent.linkedinUrl && liRegex && liRegex.test(existingStudent.linkedinUrl)) {
        duplicateField = "LinkedIn profile";
      }

      return res.status(200).json({
        success: true,
        exists: true,
        message: `A candidate with this ${duplicateField} has already registered.`,
        field: duplicateField
      });
    }

    return res.status(200).json({
      success: true,
      exists: false,
      message: "No existing registration found."
    });
  } catch (error) {
    console.error("Error checking student existence:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify registration status.",
      error: error.message
    });
  }
};

