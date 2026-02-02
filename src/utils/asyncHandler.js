const asyncHandler = (func) => {
    return (req, res, next) => {
        Promise
        .resolve(func(req, res, next))
        .catch((err) => next(err))
    }
}

export {asyncHandler}

/*

const asyncHandler = (fn) => async (req, res, next) => {
    try {
        await fn(req, res, next)
    } catch (error) {
        res.status(error.code || 500).json({
            success: false,
            message: error.message
        })
    }
}

export {asyncHandler}

    asyncHandler is a function.
    It takes another function fn.
    It returns a new function.
    That new function runs fn().

    asyncHandler = “Give me any API function → I will return a new safe API function that never crashes.”

*/