
      on run argv
        set targetUrl to item 1 of argv
        set found to false
        set browserList to {"Google Chrome", "Safari", "Firefox", "Brave Browser", "Microsoft Edge"}
        
        repeat with browserName in browserList
          if application browserName is running then
            tell application browserName
              if (count of windows) > 0 then
                repeat with w in windows
                  if (count of tabs of w) > 0 then
                    repeat with t in tabs of w
                      if (URL of t contains targetUrl) then
                        set found to true
                        tell t to reload
                        set index of w to 1
                        set active tab index of w to (get index of t)
                        tell application browserName to activate
                        exit repeat
                      end if
                    end repeat
                  end if
                  if found then exit repeat
                end repeat
              end if
            end tell
          end if
          if found then exit repeat
        end repeat
        
        if not found then
          do shell script "open " & targetUrl
        end if
      end run
    