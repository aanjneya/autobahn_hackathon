import csv
import math
import random
from datetime import date, timedelta

CORRIDORS = {
    'A93': {
        'strecken': ['A93_Inntal', 'A93_Kiefersfelden', 'A93_Gletschergarten'],
        'richtungen': ['Kufstein', 'Rosenheim']
    },
    'A8': {
        'strecken': ['A8_MQB25', 'A8_MQQ209', 'A8_MQQ213', 'A8_MQQ245', 'A8_MQQ37'],
        'richtungen': ['München', 'Salzburg']
    }
}

TIME_SLOTS = ['00-04', '04-08', '08-12', '12-16', '16-20', '20-24']

def is_ferien(d):
    # Rough approximation for demonstration
    month = d.month
    day = d.day
    if month == 8: return True
    if month == 12 and day > 23: return True
    return False

def is_oktoberfest(d):
    if d.month == 9 and d.day > 18: return True
    if d.month == 10 and d.day < 5: return True
    return False

def is_dosierung(d):
    return d.weekday() == 0 and d.month in [2,3,7,9]

with open('mock_forecast.csv', 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['datum', 'strecke', 'richtung', 'time_slot', 'pred_category', 'prob_1', 'prob_2', 'prob_3', 'prob_4', 'prob_5'])
    
    start_date = date(2026, 1, 1)
    end_date = date(2029, 12, 31)
    
    rng = random.Random(42)
    
    d = start_date
    while d <= end_date:
        dow = d.weekday() # 0=Mon, 6=Sun
        is_weekend = dow >= 5
        is_friday = dow == 4
        is_saturday = dow == 5
        is_sunday = dow == 6
        is_summer = d.month in [6, 7, 8]
        
        for corridor, config in CORRIDORS.items():
            strecke = config['strecken'][0]
            for richtung in config['richtungen']:
                is_southbound = (corridor == 'A93' and richtung == 'Kufstein') or (corridor == 'A8' and richtung == 'Salzburg')
                
                for slot in TIME_SLOTS:
                    slotHour = int(slot.split('-')[0])
                    baseScore = 1.0
                    
                    if corridor == 'A8':
                        if is_friday or is_sunday: baseScore += 2.5
                        if is_summer: baseScore += 1.5
                        if is_oktoberfest(d): baseScore += 3.0
                    elif corridor == 'A93':
                        baseScore -= 1.0
                        if is_saturday: baseScore += 3.0
                        if is_dosierung(d): baseScore += 4.0
                        
                    if 8 <= slotHour < 20: baseScore += 0.5
                    if is_weekend: baseScore += 0.3
                    if is_ferien(d): baseScore += 1.0
                    if slotHour < 4 or slotHour >= 20: baseScore *= 0.3
                    
                    noise = (rng.random() - 0.5) * (1.2 if corridor == 'A8' else 0.7)
                    baseScore += noise
                    
                    cat = max(1, min(5, round(baseScore)))
                    
                    probs = [0]*5
                    probs[cat-1] = 0.8
                    writer.writerow([
                        d.strftime('%Y-%m-%d'),
                        strecke,
                        richtung,
                        slot,
                        cat,
                        *probs
                    ])
                    
        d += timedelta(days=1)
