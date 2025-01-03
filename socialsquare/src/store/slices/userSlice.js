// features/users/getloggeduserSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// get the details of logged user
export const fetchLoggedUser = createAsyncThunk('users/fetchloggedUsers', async () => {

  const token = localStorage.getItem('token');

  if (!token) {
    return 'No token found';
  }
  else {
    try {
      const response = await fetch('http://localhost:5000/api/auth/get', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },

      });
      const data = await response.json(); // Parse the response as JSON
      console.log(data); // Log the data to check its structure

      return data; // Assuming response data contains the users

    }
    catch (error) {
      console.log(error);
    }
  }
});

// get the details of other users
export const fetchOtherUsers = createAsyncThunk('users/fetchOtherUsers', async (loggeduserId) => {

  try {
    const response = await fetch('http://localhost:5000/api/auth/other-users', {
      method: 'GET',
      headers: {
        Authorization: `${loggeduserId}`,
      },

    });
    const data = await response.json(); // Parse the response as JSON
    console.log(data); // Log the data to check its structure

    return data; // Assuming response data contains the users

  }
  catch (error) {
    console.log(error);
  }
});

// Follow a user
export const followUser = createAsyncThunk("data/followUser", async ({ loggedUserId, followUserId }, thunkAPI) => {
  try {
    const response = await fetch("http://localhost:5000/api/auth/follow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: loggedUserId, followUserId }),
    });

    if (!response.ok) {
      throw new Error("Failed to follow user");
    }
    const data = await response.json(); // Parse the response as JSON
    return { followUserId, loggedUserId, data };
  } catch (error) {
    return thunkAPI.rejectWithValue(error.message);
  }
});

// Unfollow a user
export const unfollowUser = createAsyncThunk("data/unfollowUser", async ({ loggedUserId, unfollowUserId }, thunkAPI) => {
  try {
    const response = await fetch("http://localhost:5000/api/auth/unfollow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: loggedUserId, unfollowUserId }),
    });

    if (!response.ok) {
      throw new Error("Failed to unfollow user");
    }
    const data = await response.json(); // Parse the response as JSON

    return { unfollowUserId, loggedUserId,data };
  } catch (error) {
    return thunkAPI.rejectWithValue(error.message);
  }
});

// update a user
export const updateUser = createAsyncThunk("data/updateUser", async (userData, thunkAPI) => {
  try {
    const response = await fetch('http://localhost:5000/api/auth/update-profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    
    if (response.ok) {
      return await response.json();
    }
    else {
      const error = await response.json();
      return thunkAPI.rejectWithValue(error.error);
    }
  } catch (error) {
    return thunkAPI.rejectWithValue(error.message);
  }
})

// Slice
const dataSlice = createSlice({
  name: 'users',
  initialState: {
    loggeduser: [],
    otherusers: [],
    updateusersuccess: null,
    loading: {
      loggeduser: null,
      otherusers: null,
      follow: false,
      unfollow: false,
      updateuser: null
    },
    error: {
      loggeduser: null,
      otherusers: null,
      follow: null,
      unfollow: null,
      updateuser: null,
    }
  },
  reducers: { updateFollowers: (state, action) => {
    const { userId, isFollowing } = action.payload;
    state.followers = state.followers.map((user) =>
        user._id === userId ? { ...user, isFollowing } : user
    );
},},
  extraReducers: (builder) => {
    builder
      // logged user
      .addCase(fetchLoggedUser.pending, (state) => {
        state.loading.loggeduser = true;
        state.error.loggeduser = null;
      })
      .addCase(fetchLoggedUser.fulfilled, (state, action) => {
        state.loading.loggeduser = false;
        state.loggeduser = action.payload;
      })
      .addCase(fetchLoggedUser.rejected, (state, action) => {
        state.loading.loggeduser = false;
        state.error.loggeduser = action.error.message;
      })

      // otherusers
      .addCase(fetchOtherUsers.pending, (state) => {
        state.loading.otherusers = true;
        state.error.otherusers = null;
      })
      .addCase(fetchOtherUsers.fulfilled, (state, action) => {
        state.loading.otherusers = false;
        state.otherusers = action.payload;
      })
      .addCase(fetchOtherUsers.rejected, (state, action) => {
        state.loading.otherusers = false;
        state.error.otherusers = action.error.message;
      })

      // Follow user
      .addCase(followUser.pending, (state) => {
        state.loading.follow = true;
        state.error.follow = null;
      })
      .addCase(followUser.fulfilled, (state, action) => {
        state.loading.follow = false;
        const { followUserId,data } = action.payload;
        state.loggeduser.following.push(followUserId); 
        state.otherusers = state.otherusers.filter((data) => data._id !== followUserId);
      })
      .addCase(followUser.rejected, (state, action) => {
        state.loading.follow = false;
        state.error.follow = action.payload;
      })

      // Unfollow user
      .addCase(unfollowUser.pending, (state) => {
        state.loading.unfollow = true;
        state.error.unfollow = null;
      })
      .addCase(unfollowUser.fulfilled, (state, action) => {
        state.loading.unfollow = false;
        const { unfollowUserId,data} = action.payload;
        state.loggeduser.following = state.loggeduser.following.filter((id) => id !== unfollowUserId);
        state.otherusers.push(data); 
  
      })
      .addCase(unfollowUser.rejected, (state, action) => {
        state.loading.unfollow = false;
        state.error.unfollow = action.payload;
      })

      // update users
      .addCase(updateUser.pending, (state) => {
        state.loading.updateuser = true;
        state.error.updateuser = null;
        state.updateusersuccess = null;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.loading.updateuser = false;
        state.loggeduser = action.payload;
        state.updateusersuccess = 'Profile updated successfully!';
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.loading.updateuser = false;
        state.error.updateuser = action.payload || 'Failed to create post.';
      });

  },
});
export const { updateFollowers } = dataSlice.actions;
export default dataSlice.reducer;
