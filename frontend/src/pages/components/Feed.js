import React from 'react'

const Feed = () => {
  return (
    <div className='w-50 h-100 p-3'>
      <div className="explore bordershadow">
        <input type="text" placeholder='#explore' className='bg-white border p-2 rounded w-100' />
      </div>

      <div className="new mt-3 bg-white  bordershadow  px-3 py-4 rounded w-100 d-flex gap-1 align-items-center">
        <img src="https://images.pexels.com/photos/674010/pexels-photo-674010.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500" alt="" className='logo' />
        <input type="text" placeholder='# Tell your thoughts to your friends ' className='p-2 border rounded w-100' />
        <button className='btn btn-dark'>Post</button>
      </div>
      <div className="mt-4 feed">

        <div className="post bg-white w-100 h-20 border bordershadow rounded-3 p-3">
          <div className='d-flex align-items-center gap-2'>
            <img src="https://images.pexels.com/photos/674010/pexels-photo-674010.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500" alt="" className='logo' />
            <div className='d-flex flex-column gap-0'>
              <h5 className='m-0 p-0'>sahu_vyom</h5>
              <h6 className='m-0 p-0'>Vyom Sahu</h6>
            </div>
          </div>

          <div className='mt-3'>
            <p>
              That my first post
            </p>
          </div>

          <div className='d-flex justify-content-center post-img border'>
            <img src="https://images.pexels.com/photos/674010/pexels-photo-674010.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500" alt="" className='' />

          </div>
          <div className="d-flex justify-content-between mt-3 ">
            <div className="d-flex gap-2">
              <button className='btn btn-dark btn-sm'>Like</button>
              <button className='btn btn-dark btn-sm'>Comment</button>
              <button className='btn btn-dark btn-sm'>Share</button>

            </div>
            <div>
              <button className='btn btn-dark btn-sm'>Save</button>
            </div>
          </div>
          <div className="new mt-3 bg-white  bordershadow  p-2 rounded w-100 d-flex gap-1 align-items-center">
            <img src="https://images.pexels.com/photos/674010/pexels-photo-674010.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500" alt="" className='logo' />
            <input type="text" placeholder='# Write your comment... ' className='p-2 border rounded w-100' />
            <button className='btn btn-dark'>Send</button>
          </div>
        </div>


      </div>
    </div>
  )
}

export default Feed