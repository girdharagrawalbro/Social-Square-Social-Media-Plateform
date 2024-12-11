// features/users/getloggeduserSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Async Thunk for API call
export const fetchUsers = createAsyncThunk('users/fetchUsers', async () => {
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
    console.log(response.data)
    return response.data; // Assuming response data contains the users

  }
  catch (error) {
    console.log(error);
  }
});

// Slice
const getloggeduserSlice = createSlice({
  name: 'users',
  initialState: {
    users: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});

export default getloggeduserSlice.reducer;
