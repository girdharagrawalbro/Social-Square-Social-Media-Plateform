import React from 'react'

const Category = () => {
  return (
        {/* Suggestions */}
        <div className="suggestion d-flex gap-2 mt-3">
        {categories.length > 0 ? (
          categories.map((category, index) => (
            <button key={index} className="theme-bg" value={category.category}
              onClick={handleSearch}>#{category.category}</button>
          ))
        ) : (
          <p>No categories available.</p>
        )}
      </div>

      <div className="suggestion my-2">
        {users.length > 0 && (
          <div>
            <h5>Users</h5>
            <div className=" d-flex gap-2 flex-wrap">
              {users.map((user) => (
                <button key={user._id} onClick={() => handleShow(user._id)} className="btn btn-outline-primary">
                  {user.fullname}
                </button>
              ))}
            </div>
          </div>
        )}

  
  )
}

export default Category