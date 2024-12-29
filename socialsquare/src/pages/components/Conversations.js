import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchConversations, updateLastMessage } from '../../store/slices/conversationSlice';
import { Dialog } from 'primereact/dialog';
import ChatPanel from './ChatPanel';
import { socket } from '../../socket'; // Assume this is your socket connection file
import Loader from './Loader';
import { Badge } from 'primereact/badge';
import { ToastContainer, toast } from 'react-toastify';

const Conversations = () => {
  const dispatch = useDispatch();
  const { loggeduser } = useSelector((state) => state.users);
  const { conversations, loading } = useSelector((state) => state.conversation);
  const [visible, setVisible] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedId, setSelectedId] = useState(null); // Stores the entire user object
  const [selectedName, setSelectedName] = useState(null); // Stores the entire user object
  const [selectedPic, setSelectedPic] = useState(null); // Stores the entire user object

  useEffect(() => {
    socket.on('updateUserList', (users) => {
      if (Array.isArray(users)) {
        setOnlineUsers(users);
      }
    });

    socket?.on('receiveMessage', (message) => {
      console.log(message.content)

      dispatch(updateLastMessage({ conversationId: message.conversationId, content: message.content }));

    });

    return () => {
      socket.off('updateUserList');
      socket?.off('receiveMessage');
    };

  }, [dispatch]);

  const onlineUserSet = new Set(onlineUsers.map((u) => u.userId));

  useEffect(() => {
    // Fetch conversations when loggedUser exists
    if (loggeduser?._id) {
      dispatch(fetchConversations(loggeduser?._id));
    }
  }, [dispatch, loggeduser]);

  const selectChat = ({ id, name, pic }) => {
    setSelectedId(id);
    setSelectedName(name);
    setSelectedPic(pic)
    setVisible(true);
  };

  const headerElement = (
    <div className="d-flex align-items-center gap-2">
      <img src={selectedPic} className="logo" alt={selectedName} />
      <span className="font-bold white-space-nowrap">{selectedName}</span>
    </div>
  );
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();

    // Calculate the difference in milliseconds
    const diff = now - date;

    // If less than 24 hours, show the time
    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Otherwise, show the date
    return date.toLocaleDateString();
  };

  return (
    <div className="p-3 bordershadow bg-white rounded mt-3 conversations">
      <div className="d-flex justify-message-between align-items-center">
        <h5>Messages</h5>
        <i className="pi pi-bell p-overlay-badge" style={{ fontSize: '1.5rem' }}>
          <Badge value="2"></Badge>
        </i>
      </div>
      <div className="chats d-flex flex-column gap-2">
        {loading.conversation ? (
          <Loader />
        ) : conversations.length > 0 ? (
          conversations.map((conversation) => {

            // Identify the participant who is not the logged-in user
            const otherParticipant = conversation.participants.find(
              (participant) => participant.userId !== loggeduser?._id
            );

            // Log the participant data for debugging

            if (!otherParticipant) {
              return null; // Skip rendering if no other participant is found
            }

            return (
              <div
                key={otherParticipant.userId}
                className="d-flex align-items-center gap-2 mt-2"
                onClick={() =>
                  selectChat({
                    id: otherParticipant.userId,
                    name: otherParticipant.fullname,
                    pic: otherParticipant.profilePicture,
                  })
                }
              >

                <div className="friend-img position-relative">
                  <img
                    src={otherParticipant.profilePicture}
                    alt={otherParticipant.fullname}
                    className="logo"
                  />
                  {/* Badge for online/offline status */}
                  {onlineUserSet.has(otherParticipant.userId) ? (
                    <span className="badge position-absolute bottom-0 end-0 rounded-circle bg-success"
                      style={{ width: "10px", height: "12px" }}
                    >.</span>
                  ) : null}
                </div>
                <div className="d-flex flex-column justify-message-center align-items-start w-100">
                  <h6 className="p-0 m-0">{otherParticipant.fullname}</h6>
                  <div className='d-flex justify-content-between w-100'>
                    <p
                      className="text-secondary p-0 m-0"
                      style={{ fontSize: "14px" }}
                    >
                      {conversation.lastMessageBy === loggeduser?._id ? "You" :
                        "Them"
                      }: {conversation.lastMessage}
                    </p>
                    <p className="text-secondary p-0 m-0" style={{ fontSize: "14px" }}>
                      {
                        conversation.lastMessageAt === null ? "" :
                          formatDateTime(conversation.lastMessageAt)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <p>No chats</p>
        )}
      </div>

      <ToastContainer />

      {/* Chat Dialog */}
      <Dialog
        header={headerElement}
        visible={visible}
        style={{ width: '50vw', height: '100vh' }}
        onHide={() => setVisible(false)}
      >
        {selectedId && <ChatPanel participantId={selectedId} />}
      </Dialog>
    </div>
  );
};

export default Conversations;
