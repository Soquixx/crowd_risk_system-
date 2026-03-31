def calculate_risk(count, pressure, flow, motion, safe_limit, warn_limit, area=50):
    """
    Advanced Crowd Risk Calculation
    """

    try:

        # ---- Crowd Density ----
        density = count / max(area, 1)

        # Density score (people per m²)
        if density < 2:
            density_score = 30
        elif density < 4:
            density_score = 70
        else:
            density_score = 100

        # ---- Pressure Score ----
        pressure_score = min((pressure / 1200) * 100, 100)

        # ---- Flow Score (people per minute) ----
        flow_score = min((flow / 120) * 100, 100)

        # ---- Motion Score ----
        motion_score = 20 if motion == 1 else 0

        # ---- Final Risk ----
        risk_score = (
            density_score * 0.4 +
            pressure_score * 0.3 +
            flow_score * 0.2 +
            motion_score
        )

        risk_score = min(round(risk_score, 1), 100)

        if risk_score <= safe_limit:
            status = "SAFE"
            sop = "Normal Monitoring - Crowd density within safe limits"

        elif risk_score <= warn_limit:
            status = "WARNING"
            sop = "Moderate crowd density - Increase monitoring"

        else:
            status = "CRITICAL"
            sop = "Immediate intervention required - Open exits and divert crowd"

        return risk_score, status, sop

    except Exception as e:
        print("Risk calculation error:", e)
        return 0, "ERROR", "Sensor calculation failed"