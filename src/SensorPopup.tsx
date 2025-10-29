import { Popup } from "react-leaflet"
import MiniObservationChart from "./MiniObservationChart"
import type { SensorData } from "./Map"


function SensorPopup(sensorData: SensorData) {
    return (
    <Popup maxWidth={700}>
        <div style={{ fontSize: 14, lineHeight: 1.4 }}>
            <div><b>Sensor:</b><br />{sensorData.sensorLabel || sensorData.sensor}</div>
            <div style={{ marginTop: 6 }}>
            <b>Location:</b><br />
            {sensorData.lat.toFixed(5)}, {sensorData.lon.toFixed(5)}
            </div>
            <div style={{ marginTop: 6 }}>
            <b>Observations:</b> {sensorData.observations.length}
            </div>

            <div style={{ marginTop: 10 }}>
            <MiniObservationChart observations={sensorData.observations} />
            </div>
        </div>
    </Popup>)
}

export default SensorPopup