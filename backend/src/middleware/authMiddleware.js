import jwt from 'jsonwebtoken';
import User from '../models/user.js';

export const protect = async (req, res, next) => {
    try {
        let token;

        // Check if authorization header exists and starts with Bearer
        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith('Bearer')
        ) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Not authorized, no token provided' 
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach user to request object (excluding password)
        req.user = await User.findById(decoded.id);

        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                message: 'User belonging to this token no longer exists' 
            });
        }

        next();
    } catch (error) {
        return res.status(401).json({ 
            success: false, 
            message: 'Not authorized, token failed',
            error: error.message 
        });
    }
};

// Optional: Admin-only middleware
export const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ 
            success: false, 
            message: 'Access denied. Admin privileges required.' 
        });
    }
};