from tinydb import TinyDB, Query
from datetime import datetime
import os

# Initialize database (this will create data.json in the same folder)
db = TinyDB('data.json')

def insert_data(zone, count, pressure, flow, motion, risk, status, mode='manual'):
    """Save reading to database"""
    try:
        record = {
            'zone': zone,
            'count': count,
            'pressure': pressure,
            'flow': flow,
            'motion': motion,
            'risk': risk,
            'status': status,
            'mode': mode,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        # Insert and get ID
        record_id = db.insert(record)
        
        # Debug print
        print(f"✅ Data saved! ID: {record_id}")
        print(f"   Zone: {zone}, Risk: {risk}%, Status: {status}")
        print(f"   Total records: {len(db.all())}")
        
        return True
    except Exception as e:
        print(f"❌ Error saving data: {e}")
        return False

def get_all_data(limit=100):
    """Get recent readings"""
    try:
        all_records = db.all()
        print(f"📊 Total records in database: {len(all_records)}")
        
        # Sort by timestamp (newest first)
        sorted_records = sorted(all_records, key=lambda x: x['timestamp'], reverse=True)
        
        # Return limited records
        return sorted_records[:limit]
    except Exception as e:
        print(f"❌ Error reading data: {e}")
        return []

def get_zone_stats():
    """Get statistics for each zone"""
    try:
        zones = {}
        all_records = db.all()
        
        for record in all_records:
            zone = record['zone']
            if zone not in zones:
                zones[zone] = {
                    'total_readings': 0,
                    'total_risk': 0,
                    'critical_count': 0,
                    'warning_count': 0,
                    'safe_count': 0,
                    'esp32_readings': 0,
                    'manual_readings': 0
                }
            
            zones[zone]['total_readings'] += 1
            zones[zone]['total_risk'] += record['risk']
            
            if record['status'] == 'CRITICAL':
                zones[zone]['critical_count'] += 1
            elif record['status'] == 'WARNING':
                zones[zone]['warning_count'] += 1
            else:
                zones[zone]['safe_count'] += 1
                
            if record.get('mode') == 'esp32':
                zones[zone]['esp32_readings'] += 1
            else:
                zones[zone]['manual_readings'] += 1
        
        # Calculate averages
        for zone in zones:
            if zones[zone]['total_readings'] > 0:
                zones[zone]['avg_risk'] = round(
                    zones[zone]['total_risk'] / zones[zone]['total_readings'], 1
                )
        
        return zones
    except Exception as e:
        print(f"❌ Error calculating stats: {e}")
        return {}