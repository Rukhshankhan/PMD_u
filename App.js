import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Button, TouchableOpacity } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
import * as Notifications from 'expo-notifications';
import { CameraView } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { useCameraPermissions } from 'expo-camera';
import { usePermissions as useMediaLibraryPermissions } from 'expo-media-library';
import * as SplashScreen from 'expo-splash-screen';
import Splash from './components/splash';
import { SafeAreaView } from 'react-native-safe-area-context';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [locationWatcher, setLocationWatcher] = useState(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = useMediaLibraryPermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const cameraRef = useRef(null);
  const [isSplashComplete, setIsSplashComplete] = useState(false);
  
  
  useEffect(() => {
    (async () => {


      await SplashScreen.preventAutoHideAsync();
      // Request location permissions
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      // Request notification permissions
      const { status: notificationStatus } =
        await Notifications.requestPermissionsAsync();
      if (notificationStatus !== 'granted') {
        console.log('Notification permissions denied');
      }

      // Get initial location
      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation.coords);

    })();
  }, []);
  
  useEffect(() => {
    async function prepare() {
      try {
        await SplashScreen.preventAutoHideAsync(); // Keep splash screen visible
        setTimeout(() => {
          setIsSplashComplete(true); // After loading is done, set splash complete
          SplashScreen.hideAsync(); // Hide splash screen
        }, 10000); // Show splash for 3 seconds (adjust time as needed)
      } catch (e) {
        console.warn(e);
      }
    }
    prepare();
  }, []);

  // Show Splash until isSplashComplete is true
  if (!isSplashComplete) {
    return <Splash onFinish={() => setIsSplashComplete(true)} />;
  }


  const sendNotification = async (message) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Live Location Sharing',
        body: message,
      },
      trigger: null,
    });
  };

  const sendLiveLocation = async (coords) => {
    const recipients = ['03332261056']; // Replace with actual phone numbers
    const message = `My live location is:\nLatitude: ${coords.latitude}, Longitude: ${coords.longitude}\nhttps://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;

    const isAvailable = await SMS.isAvailableAsync();
    if (isAvailable) {
      let failedRecipients = [];
      for (const recipient of recipients) {
        const { result } = await SMS.sendSMSAsync([recipient], message);
        if (result !== 'sent') {
          failedRecipients.push(recipient);
        }
      }
    

      if (failedRecipients.length > 0) {
        sendNotification(
          `Failed to send location to: ${failedRecipients.join(', ')}`
        );
      } else {
        sendNotification('Live location has been sent!');
      }
    } else {
      sendNotification('SMS is not available on this device.');
    }
  };

  const startSharingLocation = async () => {
    if (isSharing) return;

    const watcher = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 10000, // Send update every 10 seconds
        distanceInterval: 20, // Or every 20 meters
      },
      (loc) => {
        setLocation(loc.coords);
        sendLiveLocation(loc.coords); // Share updated location
      }
    );
    setLocationWatcher(watcher);
    setIsSharing(true);
    sendNotification('Live location sharing started.');
  };

  const stopSharingLocation = () => {
    if (locationWatcher) {
      locationWatcher.remove();
    }
    setIsSharing(false);
    sendNotification('Live location sharing stopped.');
  };

  if (errorMsg) {
    return (
      <View style={styles.container}>
        <Text>{errorMsg}</Text>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.container}>
        <Text>Loading location...</Text>
      </View>
    );
  }



  const saveVideoToGallery = async (uri) => {
    try {
      // Check if we have permission
      const { granted } = await MediaLibrary.getPermissionsAsync();
      if (!granted) {
        const { granted: newGranted } = await MediaLibrary.requestPermissionsAsync();
        if (!newGranted) {
          Alert.alert('Permission Denied', 'Cannot save video without media library permission');
          return;
        }
      }

      // Save the video
      const asset = await MediaLibrary.createAssetAsync(uri);
      if (!asset) {
        throw new Error('Failed to create asset');
      }

      // Create an album and save the video to it (optional)
      const album = await MediaLibrary.getAlbumAsync('SOSApp');
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync('SOSApp', asset, false);
      }

      Alert.alert('Success', 'Video saved to gallery successfully!');
      sendNotification('Video saved to gallery!');
    } catch (error) {
      console.error('Error saving video:', error);
      Alert.alert('Error', 'Failed to save video to gallery: ' + error.message);
    }
  };

  const startRecording = async () => {
    if (!cameraRef.current) return;

    const video = await cameraRef.current.recordAsync();
    setIsRecording(false);
    setCameraVisible(false);
    saveVideoToGallery(video.uri); // Save video to gallery
  };

  const stopRecording = () => {
    if (cameraRef.current) {
      cameraRef.current.stopRecording();
    }
    setIsRecording(false);
  };

  const handleSOS = () => {
    if (!cameraPermission || !cameraPermission.granted) {
      requestCameraPermission();
    }
    setCameraVisible(true);


   
  };

  


  return (

    <View style={styles.container}>
      {cameraVisible ? (
        <CameraView style={styles.camera} ref={cameraRef}>
          <View style={styles.cameraButtons}>
            {!isRecording ? (
              <TouchableOpacity
                style={styles.button}
                onPress={() => {
                  setIsRecording(true);
                  startRecording();
                }}
              >
                <Text style={styles.text}>Start Recording</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.button} onPress={stopRecording}>
                <Text style={styles.text}>Stop Recording</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.button}
              onPress={() => setCameraVisible(false)}
            >
              <Text style={styles.text}>Close Camera</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      ) : (
        <>
          <MapView
          
            style={styles.map}
            region={{
              latitude: location?.latitude || 37.78825,
              longitude: location?.longitude || -122.4324,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            showsUserLocation={true}
          >
            {location && (
              <Marker
                coordinate={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                }}
                title="You are here"
              />
            )}
          </MapView>
          <View style={styles.sosContainer}>
            <Button title="SOS" onPress={handleSOS} color="red" />
          </View>
          <View style={styles.buttonContainer}>
            {!isSharing ? (
              <Button
                title="Start Sharing Live Location"
                onPress={startSharingLocation}
              />
            ) : (
              <Button
                title="Stop Sharing Live Location"
                onPress={stopSharingLocation}
                color="red"
              />
            )}
          </View>
        </>
      )}
    </View>
  
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  sosContainer: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    zIndex: 10,
    
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    // backgroundColor: '',
    padding: 10,
    borderRadius: 50,
  },
  camera: {
    flex: 1,
  },
  cameraButtons: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoText: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 10,
  },
  button: {
    padding: 30,
    backgroundColor: 'rgba(29, 62, 226, 0.41)',
    borderRadius: 50,
  },
});









