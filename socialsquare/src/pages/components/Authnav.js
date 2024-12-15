import React from 'react'
import { Link } from 'react-router-dom';

const Authnav = () => {
    return (
        <div className='authnav justify-content-between p-4 align-items-center text-white'>
            <div><Link to="/"><h3 className='pacifico-regular'>Social Square</h3></Link>
            </div>
            <div className='d-flex gap-4 pc'>
                <Link to='/contact' className='btn text-white'>
                    Contact Us
                </Link>
                <Link to='/help' className='btn text-white'>
                    Help
                </Link>
            </div>
        </div>
    )
}

export default Authnav