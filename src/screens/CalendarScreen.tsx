import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Alert,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../../firebase.config';
import EmailVerificationBanner from '../components/EmailVerificationBanner';

interface CalendarEvent {
    id: string;
    title: string;
    date: string;
    time: string;
    description: string;
    location: string;
    createdBy: string;
    createdByEmail: string;
}

export default function CalendarScreen() {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);

    const [newEvent, setNewEvent] = useState({
        title: '',
        date: new Date().toISOString().split('T')[0],
        time: '',
        description: '',
        location: '',
    });

    const isEmailVerified = auth.currentUser?.emailVerified ?? false;

    useEffect(() => {
        const q = query(collection(db, 'events'), orderBy('date', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const eventsData: CalendarEvent[] = [];

            snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();

                // Explicitly convert everything to strings, ignore timestamps
                eventsData.push({
                    id: docSnap.id,
                    title: String(data.title || ''),
                    date: String(data.date || ''),
                    time: String(data.time || ''),
                    description: String(data.description || ''),
                    location: String(data.location || ''),
                    createdBy: String(data.createdBy || ''),
                    createdByEmail: String(data.createdByEmail || ''),
                });
            });

            setEvents(eventsData);
        });

        return () => unsubscribe();
    }, []);

    const isEventOwner = (event: CalendarEvent): boolean => {
        const user = auth.currentUser;
        if (!user) return false;

        const userEmail = user.email?.toLowerCase().trim();
        const eventEmail = event.createdByEmail?.toLowerCase().trim();

        return event.createdBy === user.uid || (userEmail && eventEmail && userEmail === eventEmail);
    };

    const handleCreateEvent = async () => {
        if (!isEmailVerified) {
            Alert.alert('Email Not Verified', 'Please verify your email before creating events.');
            return;
        }

        if (!newEvent.title || !newEvent.date || !newEvent.time) {
            Alert.alert('Missing Information', 'Please fill in all required fields');
            return;
        }

        try {
            await addDoc(collection(db, 'events'), {
                title: newEvent.title,
                date: newEvent.date,
                time: newEvent.time,
                description: newEvent.description,
                location: newEvent.location,
                createdBy: auth.currentUser?.uid || '',
                createdByEmail: auth.currentUser?.email || '',
            });

            setNewEvent({
                title: '',
                date: new Date().toISOString().split('T')[0],
                time: '',
                description: '',
                location: '',
            });

            Alert.alert('Success', 'Event created successfully!');
        } catch (error) {
            console.error('Error creating event:', error);
            Alert.alert('Error', 'Failed to create event');
        }
    };

    const handleDeleteEvent = async (event: CalendarEvent) => {
        Alert.alert(
            'Delete Event',
            `Are you sure you want to delete "${event.title}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'events', event.id));
                            if (selectedEvent?.id === event.id) {
                                setIsModalVisible(false);
                                setSelectedEvent(null);
                            }
                        } catch (error) {
                            console.error('[Calendar] Delete failed:', error);
                            Alert.alert('Error', 'Failed to delete event');
                        }
                    },
                },
            ]
        );
    };

    const filteredEvents = events.filter((event) => event.date === selectedDate);

    return (
        <View style={styles.container}>
            {!isEmailVerified && <EmailVerificationBanner />}

            <ScrollView style={styles.scrollView}>
                <Text style={styles.header}>Community Calendar</Text>

                <View style={styles.createEventSection}>
                    <Text style={styles.sectionTitle}>Create New Event</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Event Title"
                        value={newEvent.title}
                        onChangeText={(text) => setNewEvent({ ...newEvent, title: text })}
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Date (YYYY-MM-DD)"
                        value={newEvent.date}
                        onChangeText={(text) => setNewEvent({ ...newEvent, date: text })}
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Time (e.g., 3:00 PM)"
                        value={newEvent.time}
                        onChangeText={(text) => setNewEvent({ ...newEvent, time: text })}
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Location"
                        value={newEvent.location}
                        onChangeText={(text) => setNewEvent({ ...newEvent, location: text })}
                    />

                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Description"
                        value={newEvent.description}
                        onChangeText={(text) => setNewEvent({ ...newEvent, description: text })}
                        multiline
                        numberOfLines={4}
                    />

                    <TouchableOpacity style={styles.createButton} onPress={handleCreateEvent}>
                        <Text style={styles.createButtonText}>Create Event</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.eventsSection}>
                    <Text style={styles.sectionTitle}>Select Date</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Date (YYYY-MM-DD)"
                        value={selectedDate}
                        onChangeText={setSelectedDate}
                    />

                    <Text style={styles.sectionTitle}>
                        Events on {new Date(selectedDate).toLocaleDateString()}
                    </Text>

                    {filteredEvents.length === 0 ? (
                        <Text style={styles.noEvents}>No events for this date</Text>
                    ) : (
                        <View>
                            {filteredEvents.map((event) => {
                                const owner = isEventOwner(event);

                                return (
                                    <TouchableOpacity
                                        key={event.id}
                                        style={styles.eventCard}
                                        onPress={() => {
                                            setSelectedEvent(event);
                                            setIsModalVisible(true);
                                        }}
                                    >
                                        <View style={styles.eventHeader}>
                                            <View>
                                                <Text style={styles.eventTime}>{event.time}</Text>
                                                <Text style={styles.eventDate}>{new Date(event.date).toLocaleDateString()}</Text>
                                            </View>
                                            {owner && (
                                                <TouchableOpacity
                                                    onPress={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteEvent(event);
                                                    }}
                                                    style={styles.headerActionsRow}
                                                >
                                                    <Ionicons name="trash-outline" size={20} color="#666" />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                        <Text style={styles.eventTitle}>{event.title}</Text>
                                        {event.location !== '' && <Text style={styles.eventLocation}>📍 {event.location}</Text>}
                                        {event.description !== '' && <Text style={styles.eventDescription}>{event.description}</Text>}
                                        <Text style={styles.eventCreator}>by {event.createdByEmail}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </View>
            </ScrollView>

            <Modal visible={isModalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {selectedEvent && (
                            <>
                                <Text style={styles.modalTitle}>{selectedEvent.title}</Text>
                                <Text style={styles.modalDate}>
                                    {new Date(selectedEvent.date).toLocaleDateString()} at {selectedEvent.time}
                                </Text>
                                {selectedEvent.location !== '' && (
                                    <Text style={styles.modalLocation}>📍 {selectedEvent.location}</Text>
                                )}
                                {selectedEvent.description !== '' && (
                                    <Text style={styles.modalDescription}>{selectedEvent.description}</Text>
                                )}
                                <Text style={styles.modalCreator}>Created by {selectedEvent.createdByEmail}</Text>

                                {isEventOwner(selectedEvent) && (
                                    <View style={styles.modalActionRow}>
                                        <TouchableOpacity
                                            onPress={() => handleDeleteEvent(selectedEvent)}
                                            style={styles.deleteIconButton}
                                        >
                                            <Ionicons name="trash-outline" size={24} color="#666" />
                                        </TouchableOpacity>
                                    </View>
                                )}

                                <TouchableOpacity style={styles.closeButton} onPress={() => setIsModalVisible(false)}>
                                    <Text style={styles.closeButtonText}>Close</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    scrollView: {
        flex: 1,
    },
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        padding: 20,
        backgroundColor: '#2196F3',
        color: 'white',
    },
    createEventSection: {
        backgroundColor: 'white',
        padding: 20,
        marginBottom: 20,
    },
    eventsSection: {
        backgroundColor: 'white',
        padding: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#333',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 12,
        borderRadius: 8,
        marginBottom: 10,
        fontSize: 16,
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    createButton: {
        backgroundColor: '#2196F3',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    createButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    eventCard: {
        backgroundColor: '#f9f9f9',
        padding: 15,
        borderRadius: 8,
        marginBottom: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#2196F3',
    },
    eventHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    headerActionsRow: {
        padding: 4,
    },
    eventTime: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2196F3',
    },
    eventDate: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    eventTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    eventLocation: {
        fontSize: 14,
        color: '#666',
        marginBottom: 5,
    },
    eventDescription: {
        fontSize: 14,
        color: '#444',
        marginBottom: 5,
    },
    eventCreator: {
        fontSize: 12,
        color: '#999',
        fontStyle: 'italic',
    },
    noEvents: {
        textAlign: 'center',
        color: '#999',
        fontSize: 16,
        marginTop: 20,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 20,
        width: '90%',
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    modalDate: {
        fontSize: 16,
        color: '#2196F3',
        marginBottom: 10,
    },
    modalLocation: {
        fontSize: 16,
        color: '#666',
        marginBottom: 10,
    },
    modalDescription: {
        fontSize: 16,
        color: '#444',
        marginBottom: 15,
    },
    modalCreator: {
        fontSize: 14,
        color: '#999',
        fontStyle: 'italic',
        marginBottom: 15,
    },
    modalActionRow: {
        alignItems: 'center',
        marginTop: 16,
        marginBottom: 8,
    },
    deleteIconButton: {
        padding: 8,
    },
    closeButton: {
        backgroundColor: '#2196F3',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    closeButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});