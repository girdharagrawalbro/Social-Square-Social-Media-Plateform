// Import - React 
import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';

// Import - Slices functions
import { socket } from '../../socket'; // Socket connection file
import { fetchConversations, updateLastMessage } from '../../store/slices/conversationSlice';
import { getNotifications, addNewNotification,readNotifications } from '../../store/slices/conversationSlice';

// Import - UI
import { Dialog } from 'primereact/dialog';
import { Badge } from 'primereact/badge';

// Import - Components
import ChatPanel from './ChatPanel';
import Loader from './Loader';
import Notifications from './Notifications';
import Notification from './Notification';

const Conversations = () => {
  const dispatch = useDispatch();
  const { loggeduser } = useSelector((state) => state.users);
  const { conversations, loading, notifications } = useSelector((state) => state.conversation);
  const [visible, setVisible] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedId, setSelectedId] = useState(null); // Stores the entire user object
  const [selectedName, setSelectedName] = useState(null); // Stores the entire user object
  const [selectedPic, setSelectedPic] = useState(null); // Stores the entire user object
  const [visbleNotifications, setVisibleNotifications] = useState(null);
  const [lastMessageid, setLastMessageid] = useState(null);
  const [notification, setNotification] = useState(null);
  const [name, setName] = useState(null);
  // fetch the conversations 

  useEffect(() => {
    if (loggeduser?._id) {
      dispatch(fetchConversations(loggeduser?._id));
    }
  }, [dispatch, loggeduser]);

  // update online users from socket
  useEffect(() => {
    socket.on('updateUserList', (users) => {
      if (Array.isArray(users)) {
        setOnlineUsers(users);
      }
    });
    return () => {
      socket.off('updateUserList')
    };
  }, [dispatch]);

  // get new messages from socket 
  useEffect(() => {
    socket.on('receiveMessage', ({ senderId,
      socketId,
      content,
      recipientId,
      senderName,
      conversationId,
      _id,
      createdAt,
      isRead
    }) => {
      showNotification(content, senderName)
      dispatch(updateLastMessage({ conversationId, content, createdAt, messageid: _id, isRead }));
      dispatch(
        addNewNotification({
          notification: {
            recipient: recipientId,
            message: {
              content,
              id: _id,
            },
            sender: {
              id: senderId,
              fullname: senderName,
            },
            createdAt,
          },
        })
      );
    });

    return () => {
      socket.off('receiveMessage');
    }
  }, [dispatch])

  useEffect(() => {
    if (loggeduser?._id) {
      dispatch(getNotifications(loggeduser._id));
    }
  }, [dispatch, loggeduser?._id]);

  // to show new message Notifications
  const showNotification = (message, name) => {
    setNotification(message);
    setName(name)
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  const onlineUserSet = new Set(onlineUsers.map((u) => u.userId));

  const selectChat = ({ id, name, pic, lastMessage }) => {
    setSelectedId(id);
    setSelectedName(name);
    setSelectedPic(pic)
    setVisible(true);
    setLastMessageid(lastMessage);
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
      <div className="d-flex justify-content-between align-items-center">
        <h5>Messages</h5>

        <i className="pi pi-bell p-overlay-badge" style={{ fontSize: '1.5rem' }} onClick={() => setVisibleNotifications(true)}>
          <Badge value={notifications?.length}></Badge>
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
                    lastMessage: conversation.lastMessage.id
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
                      className={`p-0 m-0 ${conversation.lastMessageBy === loggeduser?._id ? "" : conversation.lastMessage.isRead ? "text-secondary" : "fw-bold text-dark "} `}
                      style={{ fontSize: "14px" }}

                    >
                      {conversation.lastMessageBy === loggeduser?._id ? "You : " :
                        conversation.lastMessageBy === otherParticipant.userId ?
                          "Them : " :
                          ""
                      }
                      {conversation.lastMessage.message}
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

      {/* Chat Dialog */}

      <Dialog
        header={headerElement}
        visible={visible}
        style={{ width: '50vw', height: '100vh' }}
        onHide={() => setVisible(false)}
      >

        {selectedId && <ChatPanel participantId={selectedId} lastMessage={lastMessageid} />}
      </Dialog>
      {notification && (
        <Notification
          message={notification}
          name={name}
        />
      )}
      {/* Notifications Dialog */}
      <Dialog
  header="Notifications"
  visible={visbleNotifications}
  style={{ width: '340px', height: '100vh' }}
  onHide={() => {
    setVisibleNotifications(false);
    const unseenNotifications = notifications
      ?.filter((noty) => !noty.read)
      .map((not) => not._id);
    if (unseenNotifications && unseenNotifications.length > 0) {
      dispatch(readNotifications(unseenNotifications));
    }
  }}
  position="right"
>
  <Notifications />
</Dialog>

    </div>
  );
};

export default Conversations;
