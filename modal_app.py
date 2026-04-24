"""Modal app for Healthcare Crossroads simulations."""

import hashlib
import json
import modal

app = modal.App("healthcare-crossroads-api")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("policyengine-us>=1.0.0", "fastapi", "flask", "flask-cors")
    .add_local_dir("healthcare_crossroads", "/root/healthcare_crossroads")
)

cache = modal.Dict.from_name("healthcare-crossroads-cache", create_if_missing=True)


def get_cache_key(data: dict) -> str:
    normalized = json.dumps(data, sort_keys=True)
    return hashlib.md5(normalized.encode()).hexdigest()


@app.function(
    image=image,
    min_containers=1,
    timeout=300,
    memory=2048,
)
@modal.fastapi_endpoint(method="POST", docs=True)
def simulate(data: dict) -> dict:
    """Run a life event simulation."""
    import sys
    sys.path.insert(0, "/root")

    from healthcare_crossroads.api import (
        create_household_from_request,
        create_event_from_request,
        format_result_for_frontend,
    )
    from healthcare_crossroads.compare import compare, compare_multiple

    try:
        cache_key = get_cache_key(data)
        try:
            cached = cache[cache_key]
            if cached:
                return cached
        except KeyError:
            pass

        household = create_household_from_request(data.get("household", {}))

        life_events = data.get("lifeEvents", [])
        single_event = data.get("lifeEvent")

        if life_events:
            events = []
            current_household = household
            for evt in life_events:
                event = create_event_from_request(
                    evt.get("type"),
                    evt.get("params", {}),
                    current_household,
                )
                events.append(event)
                current_household = event.apply(current_household)
            result = compare_multiple(household, events)
        elif single_event:
            event = create_event_from_request(
                single_event.get("type"),
                single_event.get("params", {}),
                household,
            )
            result = compare(household, event)
        else:
            raise ValueError("No life event provided")

        response = format_result_for_frontend(result)

        try:
            cache[cache_key] = response
        except Exception:
            pass

        return response
    except ValueError as e:
        return {"error": str(e)}
    except Exception as e:
        return {"error": f"Simulation failed: {str(e)}"}


@app.function(image=image)
@modal.fastapi_endpoint(method="GET", docs=True)
def health() -> dict:
    return {"status": "ok"}
