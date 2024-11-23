import React from 'react'
import { Link } from 'react-router-dom';

const Authnav = () => {
    return (
        <div className='authnav d-flex justify-content-between p-4 align-items-center text-white'>
            <div><h3 className='pacifico-regular'>Social Square</h3>
            </div>
            <div className='d-flex gap-4'>
                <Link className='btn text-white'>
                    Contact Us
                </Link>
                <Link className='btn text-white'>
                    Help
                </Link>
            </div>
        </div>
    )
}

export default Authnav