# Freediving Log Explorer

_Don't dive for numbers... But once you have them, explore them!_

See it in action at https://danielrigberg.com/freediving-log-explorer.html

## About

This web app provides a UI for tagging and graphing freediving logs to track progress and investigate areas of improvement! I made this app because my dive computer is great, but its desktop app is optimized for scuba diving, so I wasn't able to compare dive profiles meaningfully. This app is designed specifically for freediving! Also, it has lots of pretty colors.

## Frequently Asked Questions

### There are a lot of options in this app. How do I get started?
Check out the demo video, [here](https://drive.google.com/file/d/1xReaDxPt9S3srIHwfu7V3WxsMyBoOnCM/view?usp=sharing
)!

### Can anyone else see my data?
Nope! All of your data stays in your browser.

### Is my data saved in between sessions?
Since your data is only stored in the browser, it may be cleared if you reset your local memory. You can use the “Export Backup File” button to save a copy which can later be loaded with the “Load From Backup File” button.

### I don’t have a dive computer — can I add data manually?
Yes! Just click the “Manual Entry” button.

### My dive computer exports to a different file type. Will you add support for it?
Of course! Just send me a sample, and I’ll make it happen.

### My dive logs have a bunch of trailing surface time at the end -- do I have to edit them manually to fix that?
If you select one of these dives in the Dive Details tab, you should see a "Trim/Split" button above the graph. Clicking this will auto-detect surface intervals, allowing you to select which portions should be discarded or treated as independent dives. You can also insert and position missing "depth 0" data points, if your log starts while you were already underwater or ends before you reached the surface.

### Will this ever be added to any freediving community websites?
Maybe, if people find it useful! For now, it'll just live on my personal website.

### Can I contribute to the codebase?
Feel free to check out the code at https://github.com/drigberg/freediving-data-explorer and open issues or pull requests. I haven’t made a contribution guide yet, so let me know if you have any questions!

### I want to make my own version of this app. Mind if I fork the repo?
Go for it, and please share whatever you build! DM me if you have any questions about how to deploy it.

## Screenshots

**Dive profiles: deepest dive by discipline**
![Dive profiles: deepest dive by discipline](./public/2026-july-personal-bests-demo.png?raw=true)

**Timeline: longest dive by discipline**
![Timeline: longest dive by discipline](./public/2026-july-timeline-demo.png?raw=true)

**Aggregation: distance swum vertically by discipline**
![Aggregation: distance swum vertically by discipline](./public/2026-july-aggregation-demo.png?raw=true)
