// features/users/getloggeduserSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// get the details of logged user
export const fetchloggedUser = createAsyncThunk('users/fetchloggedUsers', async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    return 'No token found';
  }

  try {
    const response = await axios.get('http://localhost:5000/api/auth/get', {
      headers: {
        Authorization: `Bearer ${token}`,
      },

    });
    console.log(response.data._id)  
    return response.data; // Assuming response data contains the users

  }
  catch (error) {
    console.log(error);
  }
});

// get the details of other users
export const fetchOtherUsers = createAsyncThunk('users/fetchOtherUsers', async (id) => {

  try {
    const response = await axios.get('http://localhost:5000/api/auth/get', {
      headers: {
        Authorization: `${id}`,
      },

    });
    console.log(response.data)
    return response.data; // Assuming response data contains the users

  }
  catch (error) {
    console.log(error);
  }
});

// get the details of following 
export const fetchFollowingUsers = createAsyncThunk('users/fetchFollowingUsers', async () => {

  try {
    const response = await axios.get('http://localhost:5000/api/auth/get', {
      headers: {
        Authorization: `${response.data._id}`,
      },

    });
    console.log(response.data)
    return response.data; // Assuming response data contains the users

  }
  catch (error) {
    console.log(error);
  }
});

// get the details of Followers
export const fetchFollowersUsers = createAsyncThunk('users/fetchFollowersUsers', async () => {

  try {
    const response = await axios.get('http://localhost:5000/api/auth/get', {
      headers: {
        Authorization: `${response.data._id}`,
      },

    });
    console.log(response.data)
    return response.data; // Assuming response data contains the users

  }
  catch (error) {
    console.log(error);
  }
});

// Slice
const dataSlice = createSlice({
  name: 'data',
  initialState: {
    loggeduser: [],
    otheruser: [],
    following: [],
    followers: [],
    loading: {
      loggeduser: null,
      otheruser: null,
      following: null,
      followers: null
    },
    error: {
      loggeduser: null,
      otheruser: null,
      following: null,
      followers: null
    }
  },
  reducers: {},
  extraReducers: (builder) => {
    // logged user
    builder
      .addCase(fetchloggedUser.pending, (state) => {
        state.loading.loggeduser = true;
        state.error.loggeduser = null;
      })
      .addCase(fetchloggedUser.fulfilled, (state, action) => {
        state.loading.loggeduser = false;
        state.loggeduser = action.payload;
      })
      .addCase(fetchloggedUser.rejected, (state, action) => {
        state.loading.loggeduser = false;
        state.error.loggeduser = action.error.message;
      });

    // other user 
    builder
      .addCase(fetchOtherUsers.pending, (state) => {
        state.loading.otheruser = true;
        state.error.otheruser = null;
      })
      .addCase(fetchOtherUsers.fulfilled, (state, action) => {
        state.loading.otheruser = false;
        state.otheruser = action.payload;
      })
      .addCase(fetchOtherUsers.rejected, (state, action) => {
        state.loading.otheruser = false;
        state.error.otheruser = action.error.message;
      });


    // following
    builder
      .addCase(fetchFollowingUsers.pending, (state) => {
        state.loading.following = true;
        state.error.following = null;
      })
      .addCase(fetchFollowingUsers.fulfilled, (state, action) => {
        state.loading.following = false;
        state.following = action.payload;
      })
      .addCase(fetchFollowingUsers.rejected, (state, action) => {
        state.loading.following = false;
        state.error.following = action.error.message;
      });


    // followers
    builder
      .addCase(fetchFollowersUsers.pending, (state) => {
        state.loading.followers = true;
        state.error.followers = null;
      })
      .addCase(fetchFollowersUsers.fulfilled, (state, action) => {
        state.loading.followers = false;
        state.followers = action.payload;
      })
      .addCase(fetchFollowersUsers.rejected, (state, action) => {
        state.loading.followers = false;
        state.error.followers = action.error.message;
      });

  },
});

export default dataSlice.reducer;
